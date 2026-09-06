-- =============================================================================
-- Storefront foundation tables for Indivisible Fair Oaks-Carmichael.
--
-- These tables were bootstrapped outside the migration chain on the original
-- project. This migration makes them available on fresh databases (CI, clones,
-- restores) and is fully idempotent — safe to run on production.
--
-- Table list:
--   categories, products, product_categories, product_variations,
--   coupons, orders, order_items, reviews
--   + civic extension tables referenced by subsequent migrations:
--   events, partners, coalition_links, gallery_photos, newsletters,
--   media, civic_content_tables (already in later migrations — skipped here)
-- =============================================================================

-- ── Categories ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categories (
    id        SERIAL PRIMARY KEY,
    name      TEXT NOT NULL,
    slug      TEXT UNIQUE NOT NULL,
    wp_id     INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read categories" ON public.categories;
CREATE POLICY "Public read categories" ON public.categories
    FOR SELECT USING (true);

-- ── Products ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
    id                SERIAL PRIMARY KEY,
    name              TEXT NOT NULL,
    slug              TEXT UNIQUE NOT NULL,
    description       TEXT,
    short_description TEXT,
    price             NUMERIC(10,2) NOT NULL DEFAULT 0,
    regular_price     NUMERIC(10,2),
    sale_price        NUMERIC(10,2),
    stock_status      TEXT DEFAULT 'instock',
    image_url         TEXT,
    gallery_urls      JSONB,
    sku               TEXT,
    weight            NUMERIC(8,2),
    dimensions        JSONB,
    attributes        JSONB,
    metadata          JSONB DEFAULT '{}'::jsonb,
    wp_id             INTEGER,
    date_created      TIMESTAMPTZ,
    date_modified     TIMESTAMPTZ,
    search_vector     tsvector GENERATED ALWAYS AS (
        to_tsvector('english',
            coalesce(name, '') || ' ' ||
            coalesce(short_description, '') || ' ' ||
            coalesce(description, ''))
    ) STORED,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read products" ON public.products;
CREATE POLICY "Public read products" ON public.products
    FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins manage products" ON public.products
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true)
    );

CREATE INDEX IF NOT EXISTS products_slug_idx          ON public.products (slug);
CREATE INDEX IF NOT EXISTS products_stock_status_idx  ON public.products (stock_status);
CREATE INDEX IF NOT EXISTS products_search_vector_idx ON public.products USING GIN (search_vector);

-- ── Product ↔ Category join ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_categories (
    product_id  INTEGER NOT NULL REFERENCES public.products(id)  ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, category_id)
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read product_categories" ON public.product_categories;
CREATE POLICY "Public read product_categories" ON public.product_categories
    FOR SELECT USING (true);

-- ── Product Variations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_variations (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER REFERENCES public.products(id) ON DELETE CASCADE,
    sku         TEXT,
    price       NUMERIC(10,2),
    stock_status TEXT DEFAULT 'instock',
    image_url   TEXT,
    attributes  JSONB,
    weight      NUMERIC(8,2),
    dimensions  JSONB,
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read product_variations" ON public.product_variations;
CREATE POLICY "Public read product_variations" ON public.product_variations
    FOR SELECT USING (true);

-- ── Coupons ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coupons (
    id              SERIAL PRIMARY KEY,
    code            TEXT UNIQUE NOT NULL,
    discount_type   TEXT DEFAULT 'percent',   -- 'percent' | 'fixed'
    amount          NUMERIC(10,2),
    expiry_date     TIMESTAMPTZ,
    usage_limit     INTEGER,
    times_used      INTEGER DEFAULT 0,
    stripe_coupon_id TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage coupons" ON public.coupons;
CREATE POLICY "Admins manage coupons" ON public.coupons
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true)
    );
DROP POLICY IF EXISTS "Anon validate coupon" ON public.coupons;
CREATE POLICY "Anon validate coupon" ON public.coupons
    FOR SELECT TO anon, authenticated USING (true);

-- ── Orders ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
    id                       SERIAL PRIMARY KEY,
    user_id                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    stripe_session_id        TEXT UNIQUE,
    stripe_payment_intent_id TEXT,
    status                   TEXT DEFAULT 'pending',
    currency                 TEXT DEFAULT 'nzd',
    total                    NUMERIC(10,2),
    subtotal                 NUMERIC(10,2),
    discount_amount          NUMERIC(10,2) DEFAULT 0,
    shipping_amount          NUMERIC(10,2) DEFAULT 0,
    coupon_code              TEXT,
    billing_address          JSONB,
    shipping_address         JSONB,
    tracking_number          TEXT,
    admin_notes              TEXT,
    metadata                 JSONB DEFAULT '{}'::jsonb,
    created_at               TIMESTAMPTZ DEFAULT NOW(),
    updated_at               TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders" ON public.orders
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can read all orders" ON public.orders;
CREATE POLICY "Admins can read all orders" ON public.orders
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true)
    );
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
CREATE POLICY "Admins can update all orders" ON public.orders
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true)
    );

CREATE INDEX IF NOT EXISTS orders_user_id_idx          ON public.orders (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_session_id_key
    ON public.orders (stripe_session_id)
    WHERE stripe_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_stripe_payment_intent_id_key
    ON public.orders (stripe_payment_intent_id)
    WHERE stripe_payment_intent_id IS NOT NULL;

-- ── Order Items ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_items (
    id           SERIAL PRIMARY KEY,
    order_id     INTEGER REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id   INTEGER REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT,
    quantity     INTEGER DEFAULT 1,
    unit_price   NUMERIC(10,2),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage order items" ON public.order_items;
CREATE POLICY "Admins can manage order items" ON public.order_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true)
    );
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
CREATE POLICY "Users can view their own order items" ON public.order_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND user_id = auth.uid())
    );

-- ── Reviews ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
    id           SERIAL PRIMARY KEY,
    product_id   INTEGER REFERENCES public.products(id) ON DELETE CASCADE,
    author_name  TEXT,
    author_email TEXT,
    rating       INTEGER CHECK (rating BETWEEN 1 AND 5),
    content      TEXT,
    status       TEXT DEFAULT 'approved',
    wp_id        INTEGER,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read approved reviews" ON public.reviews;
CREATE POLICY "Public read approved reviews" ON public.reviews
    FOR SELECT USING (status = 'approved');
DROP POLICY IF EXISTS "Admins manage reviews" ON public.reviews;
CREATE POLICY "Admins manage reviews" ON public.reviews
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true)
    );
