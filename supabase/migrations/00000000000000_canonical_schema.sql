-- =============================================================================
-- Indivisible Fair Oaks-Carmichael — Canonical Schema
-- Project: mojsubkqjdruhpxbzgme
-- =============================================================================
--
-- Single source of truth for the complete database schema.
-- Replaces 33 incremental migrations that were collapsed on 2026-09-08.
--
-- Tables (18):
--   profiles, categories, products, product_categories, product_variations,
--   coupons, orders, order_items, reviews,
--   content, contact_submissions, error_reports, search_rate_limit,
--   events, partners, coalition_links, newsletters, gallery_photos
--
-- Functions:
--   handle_new_user()           — auth trigger, creates profile on signup
--   submit_contact_submission() — definer-security RPC with validation + throttle
--   search_products()           — ranked FTS over products
--   search_content()            — ranked FTS over published content
--
-- Extensions: pg_cron (error_reports 90-day retention)
--
-- Fully idempotent: safe to run on a blank or existing database.
-- =============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── 1. Profiles ───────────────────────────────────────────────────────────────
-- Mirrors auth.users. id = auth.users.id (UUID PK), user_id is a redundant FK
-- kept for legacy query compatibility. handle_new_user() populates both.

CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id     UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT UNIQUE,
    first_name  TEXT,
    last_name   TEXT,
    full_name   TEXT,
    avatar_url  TEXT,
    website     TEXT,
    username    TEXT,
    is_admin    BOOLEAN NOT NULL DEFAULT false,
    settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles (user_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles"       ON public.profiles;
DROP POLICY IF EXISTS "Service role can do anything"       ON public.profiles;

CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (
        auth.uid() = id
        OR auth.uid() = user_id
        OR (email IS NOT NULL AND auth.jwt()->>'email' = email)
    );

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (
        auth.uid() = id
        OR auth.uid() = user_id
        OR (email IS NOT NULL AND auth.jwt()->>'email' = email)
    );

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id OR auth.uid() = user_id);

-- Helper: check if calling user is admin without triggering RLS on profiles.
-- Runs as the function owner (bypasses RLS via definer security model),
-- breaking the recursion that would occur if a profiles policy queried profiles.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND is_admin = true
  );
$$;
-- Grant execute to authenticated users so the policy USING clause can call it.
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE POLICY "Admins can read all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Service role can do anything"
    ON public.profiles FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

-- Auth trigger: create profile row when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, user_id, email, first_name, last_name)
    VALUES (
        NEW.id,
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name'
    )
    ON CONFLICT (email) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            id      = EXCLUDED.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. Categories ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.categories (
    id         SERIAL PRIMARY KEY,
    name       TEXT NOT NULL,
    slug       TEXT UNIQUE NOT NULL,
    wp_id      INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read categories" ON public.categories;
CREATE POLICY "Public read categories"
    ON public.categories FOR SELECT USING (true);

-- ── 3. Products ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.products (
    id                SERIAL PRIMARY KEY,
    name              TEXT NOT NULL,
    slug              TEXT UNIQUE NOT NULL,
    description       TEXT,
    short_description TEXT,
    price             NUMERIC(10,2) NOT NULL DEFAULT 0,
    regular_price     NUMERIC(10,2),
    sale_price        NUMERIC(10,2),
    stock_status      TEXT NOT NULL DEFAULT 'instock',
    image_url         TEXT,
    gallery_urls      JSONB,
    sku               TEXT,
    weight            NUMERIC(8,2),
    dimensions        JSONB,
    attributes        JSONB,
    metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
    wp_id             INTEGER,
    date_created      TIMESTAMPTZ,
    date_modified     TIMESTAMPTZ,
    search_vector     tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(name, '')), 'A')
        || setweight(to_tsvector('english', coalesce(short_description, '')), 'B')
        || setweight(to_tsvector('english', left(coalesce(description, ''), 20000)), 'C')
    ) STORED,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_slug_idx           ON public.products (slug);
CREATE INDEX IF NOT EXISTS products_stock_status_idx   ON public.products (stock_status);
CREATE INDEX IF NOT EXISTS products_search_vector_idx  ON public.products USING GIN (search_vector);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read products"  ON public.products;
DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Public read products"
    ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins manage products"
    ON public.products FOR ALL
    USING (public.is_admin());

-- ── 4. Product ↔ Category join ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_categories (
    product_id  INTEGER NOT NULL REFERENCES public.products(id)    ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES public.categories(id)  ON DELETE CASCADE,
    PRIMARY KEY (product_id, category_id)
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read product_categories" ON public.product_categories;
CREATE POLICY "Public read product_categories"
    ON public.product_categories FOR SELECT USING (true);

-- ── 5. Product Variations ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_variations (
    id           SERIAL PRIMARY KEY,
    product_id   INTEGER REFERENCES public.products(id) ON DELETE CASCADE,
    sku          TEXT,
    price        NUMERIC(10,2),
    stock_status TEXT NOT NULL DEFAULT 'instock',
    image_url    TEXT,
    attributes   JSONB,
    weight       NUMERIC(8,2),
    dimensions   JSONB,
    metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read product_variations" ON public.product_variations;
CREATE POLICY "Public read product_variations"
    ON public.product_variations FOR SELECT USING (true);

-- ── 6. Coupons ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coupons (
    id               SERIAL PRIMARY KEY,
    code             TEXT UNIQUE NOT NULL,
    discount_type    TEXT NOT NULL DEFAULT 'percent',  -- 'percent' | 'fixed'
    amount           NUMERIC(10,2),
    expiry_date      TIMESTAMPTZ,
    usage_limit      INTEGER,
    times_used       INTEGER NOT NULL DEFAULT 0,
    stripe_coupon_id TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage coupons"  ON public.coupons;
DROP POLICY IF EXISTS "Anon validate coupon"    ON public.coupons;
CREATE POLICY "Admins manage coupons"
    ON public.coupons FOR ALL
    USING (public.is_admin());
CREATE POLICY "Anon validate coupon"
    ON public.coupons FOR SELECT
    TO anon, authenticated USING (true);

-- ── 7. Orders ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.orders (
    id                       SERIAL PRIMARY KEY,
    user_id                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    stripe_session_id        TEXT,
    stripe_payment_intent_id TEXT,
    status                   TEXT NOT NULL DEFAULT 'pending',
    currency                 TEXT NOT NULL DEFAULT 'usd',
    total                    NUMERIC(10,2),
    subtotal                 NUMERIC(10,2),
    discount_amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
    shipping_amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
    coupon_code              TEXT,
    billing_address          JSONB,
    shipping_address         JSONB,
    tracking_number          TEXT,
    admin_notes              TEXT,
    metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_session_id_key
    ON public.orders (stripe_session_id)
    WHERE stripe_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_user_id_idx
    ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS orders_stripe_payment_intent_id_key
    ON public.orders (stripe_payment_intent_id)
    WHERE stripe_payment_intent_id IS NOT NULL;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can read all orders"      ON public.orders;
DROP POLICY IF EXISTS "Admins can update all orders"    ON public.orders;
CREATE POLICY "Users can view their own orders"
    ON public.orders FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all orders"
    ON public.orders FOR SELECT
    USING (public.is_admin());
CREATE POLICY "Admins can update all orders"
    ON public.orders FOR UPDATE
    USING (public.is_admin());

-- ── 8. Order Items ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.order_items (
    id           SERIAL PRIMARY KEY,
    order_id     INTEGER REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id   INTEGER REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT,
    quantity     INTEGER NOT NULL DEFAULT 1,
    unit_price   NUMERIC(10,2),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can manage order items"        ON public.order_items;
CREATE POLICY "Users can view their own order items"
    ON public.order_items FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "Admins can manage order items"
    ON public.order_items FOR ALL
    USING (public.is_admin());

-- ── 9. Reviews ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reviews (
    id           SERIAL PRIMARY KEY,
    product_id   INTEGER REFERENCES public.products(id) ON DELETE CASCADE,
    author_name  TEXT,
    author_email TEXT,
    rating       INTEGER CHECK (rating BETWEEN 1 AND 5),
    content      TEXT,
    status       TEXT NOT NULL DEFAULT 'approved',
    wp_id        INTEGER,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read approved reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admins manage reviews"         ON public.reviews;
CREATE POLICY "Public read approved reviews"
    ON public.reviews FOR SELECT USING (status = 'approved');
CREATE POLICY "Admins manage reviews"
    ON public.reviews FOR ALL
    USING (public.is_admin());

-- ── 10. Content ───────────────────────────────────────────────────────────────
-- Civic pages, actions, announcements, blog posts.
-- sanitizeWPContent() must wrap body before render — see src/lib/sanitize.ts.

CREATE TABLE IF NOT EXISTS public.content (
    id             SERIAL PRIMARY KEY,
    title          TEXT NOT NULL,
    slug           TEXT UNIQUE NOT NULL,
    body           TEXT,
    excerpt        TEXT,
    type           TEXT NOT NULL DEFAULT 'page',  -- 'page' | 'post' | 'action' | 'event'
    status         TEXT NOT NULL DEFAULT 'publish'
                   CONSTRAINT content_status_check CHECK (status IN ('publish', 'draft')),
    published_at   TIMESTAMPTZ,
    featured_image TEXT,
    metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
    search_vector  tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A')
        || setweight(to_tsvector('english', left(coalesce(body, ''), 50000)), 'B')
    ) STORED,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_search_vector_idx ON public.content USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS content_visibility_idx    ON public.content (status, published_at);

ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public content is viewable by everyone" ON public.content;
CREATE POLICY "Public content is viewable by everyone"
    ON public.content FOR SELECT
    USING (
        status = 'publish'
        AND (published_at IS NULL OR published_at <= now())
    );

-- ── 11. Contact Submissions ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contact_submissions (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL,
    message       TEXT NOT NULL,
    wants_copy    BOOLEAN NOT NULL DEFAULT false,
    email_sent_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit contact form"      ON public.contact_submissions;
DROP POLICY IF EXISTS "Admins can view contact submissions" ON public.contact_submissions;
CREATE POLICY "Anyone can submit contact form"
    ON public.contact_submissions FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);
CREATE POLICY "Admins can view contact submissions"
    ON public.contact_submissions FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- RPC: validated, throttled entry point for anonymous contact form submission.
-- Runs with elevated privileges so anon can insert without a SELECT policy (INSERT..RETURNING
-- would fail if anon cannot SELECT the new row — this avoids that entirely).
CREATE OR REPLACE FUNCTION public.submit_contact_submission(
    p_name      text,
    p_email     text,
    p_message   text,
    p_wants_copy boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_id integer;
BEGIN
    -- Global rate cap: 30 submissions per 10 minutes
    IF (
        SELECT count(*) FROM public.contact_submissions
        WHERE created_at > now() - interval '10 minutes'
    ) >= 30 THEN
        RAISE EXCEPTION 'submission rate limit exceeded';
    END IF;

    -- Field presence
    IF p_name IS NULL OR p_email IS NULL OR p_message IS NULL THEN
        RAISE EXCEPTION 'missing fields';
    END IF;
    -- Name: 2–100 chars, no control characters
    IF char_length(p_name) < 2 OR char_length(p_name) > 100
       OR p_name ~ '[\x00-\x1f\x7f]' THEN
        RAISE EXCEPTION 'invalid name';
    END IF;
    -- Email: ≤254 chars, must contain @, no control characters
    IF char_length(p_email) > 254 OR p_email !~ '@' OR p_email ~ '[\x00-\x1f\x7f]' THEN
        RAISE EXCEPTION 'invalid email';
    END IF;
    -- Message: 10–5000 chars
    IF char_length(p_message) < 10 OR char_length(p_message) > 5000 THEN
        RAISE EXCEPTION 'invalid message';
    END IF;

    INSERT INTO public.contact_submissions (name, email, message, wants_copy)
    VALUES (p_name, p_email, p_message, COALESCE(p_wants_copy, false))
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_contact_submission(text, text, text, boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submit_contact_submission(text, text, text, boolean) TO anon, authenticated;

-- ── 12. Error Reports ─────────────────────────────────────────────────────────
-- Client crash telemetry. Anon insert-only. Admin read. 90-day auto-prune.

CREATE TABLE IF NOT EXISTS public.error_reports (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    fingerprint      TEXT NOT NULL,
    digest           TEXT,
    message          TEXT NOT NULL CONSTRAINT error_reports_message_len          CHECK (char_length(message) <= 500),
    stack            TEXT         CONSTRAINT error_reports_stack_len             CHECK (stack IS NULL OR char_length(stack) <= 2000),
    component_stack  TEXT         CONSTRAINT error_reports_component_stack_len   CHECK (component_stack IS NULL OR char_length(component_stack) <= 1000),
    path             TEXT,
    user_agent       TEXT,
    category         TEXT NOT NULL DEFAULT 'other'
                     CONSTRAINT error_reports_category_check CHECK (
                         category = ANY(ARRAY['runtime','build','deploy','ui','api',
                                              'database','network','auth','stripe',
                                              'supabase','other'])
                     )
);

CREATE INDEX IF NOT EXISTS error_reports_created_at_idx  ON public.error_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS error_reports_fingerprint_idx ON public.error_reports (fingerprint);
CREATE INDEX IF NOT EXISTS error_reports_category_idx    ON public.error_reports (category, created_at DESC);

ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit an error report" ON public.error_reports;
DROP POLICY IF EXISTS "Admins can view error reports"     ON public.error_reports;
CREATE POLICY "Anyone can submit an error report"
    ON public.error_reports FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);
CREATE POLICY "Admins can view error reports"
    ON public.error_reports FOR SELECT
    USING (public.is_admin());

-- 90-day retention via pg_cron
DO $retention$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'prune-error-reports',
            '0 3 * * *',
            'DELETE FROM public.error_reports WHERE created_at < now() - interval ''90 days'''
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'error_reports retention schedule skipped: %', SQLERRM;
END;
$retention$;

-- ── 13. Search Rate Limit ─────────────────────────────────────────────────────
-- Per-IP rolling-window store consumed by the /search edge function.

CREATE TABLE IF NOT EXISTS public.search_rate_limit (
    id         bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    ip         TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.search_rate_limit IS
    'Rate-limiting store for /search edge function: per-IP rolling-window search request count.';

CREATE INDEX IF NOT EXISTS idx_search_rate_limit_ip ON public.search_rate_limit (ip, created_at);

ALTER TABLE public.search_rate_limit ENABLE ROW LEVEL SECURITY;

-- ── 14. Events ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.events (
    slug          TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    category      TEXT NOT NULL
                  CHECK (category IN ('Meetings','Resistance Choir','Voter Mobilization','Rallies & Street Action')),
    date_label    TEXT NOT NULL,
    time_label    TEXT NOT NULL,
    starts_at     TIMESTAMPTZ,
    ends_at       TIMESTAMPTZ,
    location_name TEXT NOT NULL DEFAULT '',
    address       TEXT NOT NULL DEFAULT '',
    description   TEXT NOT NULL DEFAULT '',
    rsvp_url      TEXT NOT NULL DEFAULT '',
    highlight     BOOLEAN NOT NULL DEFAULT false,
    sort_order    INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_sort_idx     ON public.events (sort_order, starts_at);
CREATE INDEX IF NOT EXISTS events_category_idx ON public.events (category);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public events viewable" ON public.events;
CREATE POLICY "Public events viewable"
    ON public.events FOR SELECT
    TO anon, authenticated USING (true);
GRANT SELECT ON public.events TO anon, authenticated;

INSERT INTO public.events
    (slug, title, category, date_label, time_label, starts_at, ends_at,
     location_name, address, description, rsvp_url, highlight, sort_order)
VALUES
    ('monthly-gathering-sep','Monthly Chapter Gathering & Food Bank Drive','Meetings',
     'Tuesday, September 1, 2026','6:30 PM – 8:00 PM',
     '2026-09-01T18:30:00-07:00','2026-09-01T20:00:00-07:00',
     'St. Michael''s Episcopal Church','2140 Mission Avenue, Carmichael, CA 95608',
     'Our primary monthly community gathering. Agenda includes federal and local election strategies, organizing updates, and a food drive for our neighborhood pantry. Please bring canned or non-perishable goods.',
     'https://www.mobilize.us/indivisible/',true,10),
    ('good-trouble-weekend','Good Trouble Lives On! Weekend of Action','Rallies & Street Action',
     'Friday–Sunday, July 17–19, 2026','10:00 AM – 2:00 PM Daily',
     '2026-07-17T10:00:00-07:00','2026-07-19T14:00:00-07:00',
     'Fair Oaks & Carmichael Public Squares','Fair Oaks Blvd & Manzanita Ave, Carmichael, CA',
     'Honoring John Lewis through direct community presence, voter rights education, and deep canvassing around voter protection.',
     'https://www.goodtroubleliveson.org/',true,20),
    ('choir-rehearsal-biweekly','Carmichael Resistance Choir Bi-Weekly Rehearsal','Resistance Choir',
     'Every Other Wednesday','6:30 PM – 8:00 PM',
     '2026-09-09T18:30:00-07:00','2026-09-09T20:00:00-07:00',
     'Community Center / Church Hall','Carmichael, CA (Address provided upon registration)',
     'Learn 4-part harmonies, freedom anthems, and chants of resistance. No auditions or singing experience required — all voices are warmly welcomed!',
     'mailto:contact@indivisiblefairoaks.org?subject=Join%20Resistance%20Choir',false,30),
    ('weekend-protest-song','Weekend of Protest Song Demonstration','Resistance Choir',
     'Saturday Afternoon Rush','3:00 PM – 4:30 PM',
     '2026-09-19T15:00:00-07:00','2026-09-19T16:30:00-07:00',
     'Carmichael Corner Demonstration','Corner of Fair Oaks Blvd & Manzanita Ave, Carmichael, CA',
     'Singing protest to afternoon traffic and community patrons. Bring your signs, lawn chairs, and voices to stand up for democracy!',
     'https://www.mobilize.us/indivisible/event/1011420/',false,40),
    ('deep-canvass-training','Deep Canvass Political Persuasion Training','Voter Mobilization',
     'Saturday, September 12, 2026','10:00 AM – 1:00 PM',
     '2026-09-12T10:00:00-07:00','2026-09-12T13:00:00-07:00',
     'Online / Zoom Workshop','Sacramento County / Virtual',
     'Learn how to engage conflicted voters in meaningful 1-on-1 dialogue to counter disinformation and build voter turnout in swing districts.',
     'https://www.mobilize.us/wethefighters/',false,50),
    ('fall-postcards-drive','Postcard Writing & Voter Outreach Blitz','Voter Mobilization',
     'Sunday, September 20, 2026','2:00 PM – 4:00 PM',
     '2026-09-20T14:00:00-07:00','2026-09-20T16:00:00-07:00',
     'Fair Oaks Community Clubhouse','7997 California Ave, Fair Oaks, CA 95628',
     'Writing handwritten postcards to registered voters in California swing districts encouraging turnout. Postcards, addresses, and scripts provided.',
     'mailto:contact@indivisiblefairoaks.org?subject=Postcard%20Blitz%20RSVP',false,60)
ON CONFLICT (slug) DO NOTHING;

-- ── 15. Partners ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.partners (
    slug        TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    url         TEXT NOT NULL DEFAULT '',
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partners_sort_idx ON public.partners (sort_order);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public partners viewable" ON public.partners;
CREATE POLICY "Public partners viewable"
    ON public.partners FOR SELECT
    TO anon, authenticated USING (true);
GRANT SELECT ON public.partners TO anon, authenticated;

INSERT INTO public.partners (slug, name, category, description, url, sort_order)
VALUES
    ('national-indivisible','National Indivisible Project','National Movement',
     'A grassroots movement of thousands of local chapters with a shared vision of a democracy by the people, of the people, and for all people.',
     'https://indivisible.org',10),
    ('indivisible-ca-statestrong','Indivisible California StateStrong','Statewide Coalition',
     'Connecting dozens of local Indivisible chapters across California to coordinate legislative advocacy in Sacramento and champion state-level progressive policy.',
     'https://indivisibleca.org',20),
    ('sister-district-sac','Sister District Sacramento','Electoral Partner',
     'Mobilizing volunteers to build lasting progressive power in state legislatures across the country by supporting critical swing-district candidates.',
     'https://sisterdistrict.com',30),
    ('5calls','5 Calls: Make Your Voice Heard','Civic Tech Partner',
     'The most effective, fast way for everyday citizens to call their elected officials about crucial democracy, healthcare, and civil rights bills.',
     'https://5calls.org',40),
    ('lwv-sacramento','League of Women Voters Sacramento County','Voting Rights & Nonpartisan Guides',
     'Empowering voters and defending democracy through nonpartisan ballot analysis, candidate forums, and local high school voter registration drives.',
     'https://my.lwv.org/california/sacramento-county',50),
    ('aclu-norcal','ACLU of Northern California','Civil Liberties & Legal Defense',
     'Guarding the constitutional rights of all Californians through strategic litigation, community education, and policy reform.',
     'https://www.aclunc.org',60)
ON CONFLICT (slug) DO NOTHING;

-- ── 16. Coalition Links ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coalition_links (
    slug        TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT '',
    url         TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    badge       TEXT,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coalition_links_sort_idx     ON public.coalition_links (sort_order);
CREATE INDEX IF NOT EXISTS coalition_links_category_idx ON public.coalition_links (category);

ALTER TABLE public.coalition_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public coalition links viewable" ON public.coalition_links;
CREATE POLICY "Public coalition links viewable"
    ON public.coalition_links FOR SELECT
    TO anon, authenticated USING (true);
GRANT SELECT ON public.coalition_links TO anon, authenticated;

INSERT INTO public.coalition_links (slug, name, category, url, description, badge, sort_order)
VALUES
    ('indivisible-national','Indivisible National','Movement Partners',
     'https://indivisible.org',
     'The national movement to elect progressive leaders and rebuild our democracy. Guides, toolkits, and national call campaigns.',
     'National Hub',10),
    ('indivisible-ca','Indivisible California State Network','Movement Partners',
     'https://indivisibleca.org',
     'Coordinating Indivisible chapters across California for Sacramento legislative advocacy and statewide election protection.',
     NULL,20),
    ('mobilize-directory','Mobilize.us Indivisible Directory','Movement Partners',
     'https://www.mobilize.us/indivisible/',
     'Find upcoming local meetings, rallies, text banks, and phone banks organized by Indivisible chapters across California.',
     NULL,30),
    ('ca-voter-reg','California Online Voter Registration','Voter Resources',
     'https://registertovote.ca.gov',
     'Register to vote online or update your address and party registration with the California Secretary of State.',
     'Official SOS',40),
    ('ballottrax','Where''s My Ballot? (BallotTrax)','Voter Resources',
     'https://wheresmyballot.sos.ca.gov',
     'Track when your vote-by-mail ballot is printed, mailed, received, and counted by your county elections office.',
     NULL,50),
    ('sac-elections','Sacramento County Elections Division','Voter Resources',
     'https://elections.saccounty.gov',
     'Official county portal for ballot drop-off locations, Vote Center hours, and official election results.',
     NULL,60),
    ('lwv-sacramento','League of Women Voters of Sacramento County','Civic Education',
     'https://www.lwvsacramento.org',
     'Trusted, nonpartisan in-depth analysis of statewide ballot propositions and local candidate debates.',
     NULL,70),
    ('aclu-norcal','ACLU of Northern California','Civic Education',
     'https://www.aclunc.org',
     'Defending civil liberties, constitutional rights, and public protest protections across Northern California.',
     NULL,80),
    ('actblue-portal','ActBlue Contribution Portal','Support',
     'https://secure.actblue.com/donate/indivisiblefoc1432155925',
     'Direct contribution portal to support Indivisible Fair Oaks-Carmichael grassroots organizing.',
     'Support Our Work',90)
ON CONFLICT (slug) DO NOTHING;

-- ── 17. Newsletters ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.newsletters (
    slug         TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    date_label   TEXT NOT NULL DEFAULT '',
    description  TEXT NOT NULL DEFAULT '',
    topics       TEXT[] NOT NULL DEFAULT '{}',
    sort_order   INT NOT NULL DEFAULT 0,
    published_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS newsletters_sort_idx ON public.newsletters (sort_order);

ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public newsletters viewable" ON public.newsletters;
CREATE POLICY "Public newsletters viewable"
    ON public.newsletters FOR SELECT
    TO anon, authenticated USING (true);
GRANT SELECT ON public.newsletters TO anon, authenticated;

INSERT INTO public.newsletters (slug, title, date_label, description, topics, sort_order, published_at)
VALUES
    ('summer-action-bulletin-2026','Indivisible Fair Oaks-Carmichael Summer Action Bulletin','July 2026',
     'Summer organizing priorities: preparing for upcoming elections, choir street demonstrations at Fair Oaks & Manzanita, local food bank drives, and phone-banking schedules.',
     ARRAY['Election Defense','Choir Actions','Food Drive','Mobilize Events'],10,'2026-07-01T00:00:00Z'),
    ('midyear-review-2026','Mid-Year Grassroots Review & Legislative Round-up','June 2026',
     'Review of California state legislative priorities, local city council actions, deep canvass voter persuasion results, and upcoming coalition rallies in Citrus Heights.',
     ARRAY['California Bills','Deep Canvass','Sunrise Solidarity','Voter Outreach'],20,'2026-06-01T00:00:00Z'),
    ('spring-mobilization-2026','Spring Mobilization & Resistance Choir Launch','May 2026',
     'Announcing the official schedule for the Carmichael Resistance Choir, spring town hall debriefs, and youth voter pre-registration drives across Sacramento County.',
     ARRAY['Resistance Choir','Youth Pre-Registration','Town Halls'],30,'2026-05-01T00:00:00Z'),
    ('spring-newsletter-2026','Defending Democratic Norms: Spring Chapter Newsletter','April 2026',
     'National Indivisible strategy updates, local community resistance workshops, and mutual aid efforts for Fair Oaks and Carmichael neighborhood families.',
     ARRAY['National Strategy','Mutual Aid','Community Care'],40,'2026-04-01T00:00:00Z')
ON CONFLICT (slug) DO NOTHING;

-- ── 18. Gallery Photos ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gallery_photos (
    id           SERIAL PRIMARY KEY,
    slug         TEXT NOT NULL UNIQUE,
    storage_path TEXT NOT NULL,
    alt          TEXT NOT NULL DEFAULT '',
    caption      TEXT NOT NULL DEFAULT '',
    location     TEXT NOT NULL DEFAULT '',
    category     TEXT NOT NULL DEFAULT '',
    sign_quote   TEXT,
    date_label   TEXT NOT NULL DEFAULT '',
    photographer TEXT NOT NULL DEFAULT 'Indivisible Fair Oaks Archive',
    is_hero      BOOLEAN NOT NULL DEFAULT false,
    is_pair      BOOLEAN NOT NULL DEFAULT false,
    sort_order   INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gallery_photos_sort_idx     ON public.gallery_photos (sort_order);
CREATE INDEX IF NOT EXISTS gallery_photos_category_idx ON public.gallery_photos (category);
CREATE INDEX IF NOT EXISTS gallery_photos_hero_idx     ON public.gallery_photos (is_hero, sort_order)
    WHERE is_hero = true;

ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public gallery viewable" ON public.gallery_photos;
CREATE POLICY "Public gallery viewable"
    ON public.gallery_photos FOR SELECT
    TO anon, authenticated USING (true);
GRANT SELECT ON public.gallery_photos TO anon, authenticated;

INSERT INTO public.gallery_photos
    (slug, storage_path, alt, caption, location, category, sign_quote, date_label, is_hero, is_pair, sort_order)
VALUES
    ('no-kings-constitution-banner','gallery/no-kings-constitution-banner.jpg',
     'Chapter members with handcrafted constitutional rights banner',
     'No Kings in America: Chapter Members with Handcrafted Constitutional Rights Banner',
     'Fair Oaks Blvd & Sunrise Blvd, Fair Oaks','No Kings Sacramento',
     'No Kings In America — The Constitution','Chapter Stand-Out',true,false,10),
    ('unity-be-brave','gallery/unity-be-brave-with-us.jpg',
     'Be Brave With Us solidarity stand-out','Be Brave With Us! Solidarity Line',
     'Fair Oaks Blvd & Sunrise Blvd','Sacramento Unity',
     'Be Brave With Us! Indivisible Fair Oaks','Boulevard Stand-Out',true,false,20),
    ('witty-grandfather','gallery/witty-grandfather-ww2-antifa.jpg',
     'Witty WW2 antifa protest sign','Historical Truth On Cardboard',
     'Fair Oaks Boulevard','Witty & Funny Signs',
     'If Your Grandfather Fought In WW2 He Was Anti-Fascist!','Sidewalk Action',true,false,30),
    ('legacy-highway-banner','gallery/highway-overpass-good-trouble.jpg',
     'Good Trouble banner drop on Highway 50 overpass','Highway 50 Good Trouble Banner Drop',
     'Highway 50 Pedestrian Overpass','Legacy Site Archives',
     'Good Trouble Lives On! Honoring John Lewis','Annual Highway Action',true,false,40),
    ('choir-outdoor','gallery/choir-outdoor-rehearsal.jpg',
     'Carmichael Resistance Choir outdoor rehearsal','Carmichael Resistance Choir Outdoor Rehearsal',
     'Carmichael Community Park','Resistance Choir',
     'Singing For Democracy Under The Trees','Vocal Resistance Rehearsal',false,true,50),
    ('norcal-voter-rights','gallery/voter-registration-homeless-vote.jpg',
     'Grassroots voter registration action','Grassroots Voter Registration Action',
     'Sacramento Community Hub','NorCal Resist',
     'Homeless Does Not Mean Voteless','Civic Engagement Drive',false,true,60),
    ('no-kings-standout','gallery/no-kings-roadside-standout.jpg',
     'Gold Country Blvd grassroots mobilization','Gold Country Blvd Grassroots Mobilization',
     'Gold Country Blvd, Fair Oaks','No Kings Sacramento',
     'No ICE, No War, No King','Weekend Stand-Out',false,false,70),
    ('norcal-mutual-aid','gallery/mutual-aid-fair-oaks-park.jpg',
     'Indivisible mutual aid and food drive','Indivisible Mutual Aid & Food Drive',
     'Fair Oaks Park Pavilion','NorCal Resist',
     'Mutual Aid Across Every Neighborhood','Community Food Drive',false,false,80),
    ('unity-one-voice','gallery/unity-one-voice-vote-counts.jpg',
     'Sacramento grassroots democracy stand-out','Sacramento Grassroots Democracy Stand-Out',
     'Fair Oaks Village Center','Sacramento Unity',
     'One Voice — Your Vote Counts In CA','Community Gathering',false,false,90),
    ('witty-cat-nope','gallery/witty-cat-nope-since-1776.jpg',
     'Satirical grassroots wit sign','Satirical Grassroots Wit',
     'Carmichael Community Sidewalk','Witty & Funny Signs',
     'Democracy Needs Your Courage (NOPE Since 1776)','Grassroots Rally',false,false,100),
    ('legacy-foam-hands','gallery/highway-overpass-foam-hands.jpg',
     'Overpass waves to Highway 50 commuters','Overpass Waves to Highway 50 Commuters',
     'Highway 50 Overpass, Sacramento','Legacy Site Archives',
     'Waving For Democracy & Justice','Overpass Action',false,false,110),
    ('legacy-official-banner','gallery/legacy-chapter-official-banner.jpg',
     'Official chapter welcome banner','Official Chapter Welcome Banner',
     'Fair Oaks & Carmichael, CA','Legacy Site Archives',
     'Indivisible Fair Oaks - Carmichael','Historic Chapter Archive',false,false,120),
    ('norcal-brake-light','gallery/norcal-resist-brake-light-clinic.jpg',
     'NorCal Resist brake light clinic community action','NorCal Resist Free Brake Light Clinic',
     'Carmichael Community Center','NorCal Resist',
     'Free Brake Light Repairs — No Questions Asked','Community Safety Clinic',false,false,130)
ON CONFLICT (slug) DO NOTHING;

-- ── Full-Text Search Functions ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.search_products(search_query text, max_rows int DEFAULT 24)
RETURNS TABLE (
    id            int,
    name          text,
    slug          text,
    price         numeric,
    regular_price numeric,
    sale_price    numeric,
    image_url     text,
    stock_status  text,
    rank          real
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT
        p.id,
        p.name::text,
        p.slug::text,
        p.price,
        p.regular_price,
        p.sale_price,
        p.image_url,
        p.stock_status::text,
        ts_rank(p.search_vector, websearch_to_tsquery('english', search_query)) AS rank
    FROM public.products p
    WHERE p.search_vector @@ websearch_to_tsquery('english', search_query)
      AND p.stock_status = 'instock'
    ORDER BY rank DESC, p.created_at DESC NULLS LAST
    LIMIT least(greatest(max_rows, 1), 50);
$$;

CREATE OR REPLACE FUNCTION public.search_content(search_query text, max_rows int DEFAULT 10)
RETURNS TABLE (
    id         int,
    title      text,
    slug       text,
    type       text,
    created_at timestamptz,
    rank       real
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT
        c.id,
        c.title::text,
        c.slug::text,
        c.type::text,
        c.created_at,
        ts_rank(c.search_vector, websearch_to_tsquery('english', search_query)) AS rank
    FROM public.content c
    WHERE c.search_vector @@ websearch_to_tsquery('english', search_query)
      AND c.status = 'publish'
      AND (c.published_at IS NULL OR c.published_at <= now())
    ORDER BY rank DESC, c.created_at DESC NULLS LAST
    LIMIT least(greatest(max_rows, 1), 50);
$$;

-- =============================================================================
-- End of canonical schema
-- =============================================================================
