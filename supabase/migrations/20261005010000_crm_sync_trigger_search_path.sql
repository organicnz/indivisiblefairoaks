-- ═══════════════════════════════════════════════════════════════════════════
-- CRM sync triggers: pin `search_path` to ''
--
-- Two of the three `fn_sync_*_to_crm()` triggers were created with
-- `SET search_path = public`, the only elevated-privilege functions in this
-- schema that did not pin it. (The third,
-- `fn_sync_contact_submission_to_crm()`, is declared in 20261005020000
-- instead: that migration's version also writes `do_not_email`, so declaring
-- the pre-consent body here would contribute nothing except a dead
-- intermediate state — the exact trap this file's own "byte-identical" note
-- below warns about, applied in reverse. A partial apply recording this file
-- but not that one would then read as though the opt-in-by-default fix had
-- landed while the trigger still omitted the column.)
-- Every other one — `crm_stats()`,
-- `check_crm_email_flood()`, `touch_content_updated_at()`, and the privileged
-- `crm_sync_historical_records()` — uses `SET search_path = ''` with qualified
-- references, and the header of 20260929120000 calls out the difference.
--
-- ── Why it matters here specifically ─────────────────────────────────────────
--
-- `public` is writable by `anon`: `contact_submissions` has an
-- `WITH CHECK (true)` INSERT policy for `anon`, and that insert fires
-- `fn_sync_contact_submission_to_crm()`. So this function's privilege context —
-- table owner, RLS bypassed — is reachable from the public internet on every
-- contact-form submission, running with a search_path that begins at a schema
-- anon can create objects in.
--
-- The standard attack follows: create an object earlier in the search_path than
-- the relations these functions resolve by bare name, and the function binds the
-- attacker's object. `search_path = ''` plus qualified references closes it — an
-- unqualified name then resolves nowhere and raises, rather than silently
-- binding to something an attacker controls. Failing loudly is the point: a
-- migration that breaks the trigger is visible in staging, whereas a hijacked
-- one is not visible anywhere.
--
-- `CREATE OR REPLACE` rather than `ALTER FUNCTION … SET search_path`: these
-- bodies use unqualified names — `crm_contacts` inside ON CONFLICT DO UPDATE,
-- `jsonb_build_object`, `split_part`, `substring`, `array_append`. Changing only
-- the path would break every one of them at runtime. Recreating with qualified
-- names *and* an empty path is the only correct shape.
--
-- ── Bodies are otherwise byte-identical to the *latest* prior version ────────
--
-- For each function, the version being replaced is the most recent
-- `CREATE OR REPLACE` before this migration — not necessarily the original:
--
--   fn_sync_profile_to_crm
--       20260922200000_crm_realtime_triggers.sql (never replaced since).
--       Keeps its `v_first_name` / `v_last_name` / `v_status` derivation from
--       `full_name` and `is_admin`, and its `auth_signup` source with
--       `registered-member` / `organizer` tags.
--
--   fn_sync_order_to_crm
--       20260923140000_crm_fixes.sql — NOT the 20260922200000 original. That
--       later migration replaced it to make donation accounting idempotent, and
--       two of its changes are load-bearing:
--
--         1. the contact upsert inserts `0` for `total_donated_cents` and the
--            amount is applied by a *separate* UPDATE guarded on the order
--            activity row not existing yet. The original incremented inside the
--            upsert, so re-firing the trigger on a status change double-counted
--            every donation.
--         2. the `profiles` fallback carries `LIMIT 1`. Without it, a `profiles`
--            row satisfying both halves of the OR returns two rows and
--            `SELECT … INTO` takes an arbitrary one.
--
--       Copying the earlier body here would silently revert both fixes on a
--       schema where they had been in place for weeks. That is the specific trap
--       of an append-only migration that re-declares an existing function: the
--       declaration you copy from is not necessarily the one in force.
--
-- Only `SET search_path` and the qualification of `crm_contacts.` references
-- changed. Worth reading before touching either: `(NEW.total * 100)::integer`
-- truncates cents.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 2. User Profiles -> CRM Contacts ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_sync_profile_to_crm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_clean_email text;
    v_first_name text;
    v_last_name text;
    v_status text;
BEGIN
    IF NEW.email IS NULL OR trim(NEW.email) = '' THEN
        RETURN NEW;
    END IF;

    v_clean_email := lower(trim(NEW.email));
    v_first_name := coalesce(NEW.first_name, split_part(trim(coalesce(NEW.full_name, '')), ' ', 1));
    IF NEW.last_name IS NOT NULL THEN
        v_last_name := NEW.last_name;
    ELSIF position(' ' in trim(coalesce(NEW.full_name, ''))) > 0 THEN
        v_last_name := substring(trim(NEW.full_name) from position(' ' in trim(NEW.full_name)) + 1);
    ELSE
        v_last_name := NULL;
    END IF;

    v_status := CASE WHEN NEW.is_admin IS TRUE THEN 'organizer' ELSE 'supporter' END;

    INSERT INTO public.crm_contacts (
        email,
        first_name,
        last_name,
        source,
        status,
        tags,
        created_at,
        updated_at
    ) VALUES (
        v_clean_email,
        v_first_name,
        v_last_name,
        'auth_signup',
        v_status,
        CASE WHEN NEW.is_admin IS TRUE
            THEN ARRAY['organizer', 'registered-member']
            ELSE ARRAY['registered-member']
        END,
        coalesce(NEW.created_at, now()),
        now()
    )
    ON CONFLICT (email) DO UPDATE
    SET
        first_name = coalesce(public.crm_contacts.first_name, EXCLUDED.first_name),
        last_name = coalesce(public.crm_contacts.last_name, EXCLUDED.last_name),
        status = CASE
            WHEN EXCLUDED.status = 'organizer' THEN 'organizer'
            ELSE public.crm_contacts.status
        END,
        tags = CASE
            WHEN EXCLUDED.status = 'organizer' AND NOT ('organizer' = ANY(public.crm_contacts.tags))
                THEN array_append(public.crm_contacts.tags, 'organizer')
            WHEN NOT ('registered-member' = ANY(public.crm_contacts.tags))
                THEN array_append(public.crm_contacts.tags, 'registered-member')
            ELSE public.crm_contacts.tags
        END,
        updated_at = now();

    RETURN NEW;
END;
$$;

-- ── 3. Store Orders / Donations -> CRM Contacts & Activities ─────────────────

CREATE OR REPLACE FUNCTION public.fn_sync_order_to_crm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_clean_email text;
    v_contact_id uuid;
    v_cents integer;
BEGIN
    -- Only trigger on successful/processing orders
    IF NEW.status NOT IN ('completed', 'processing') THEN
        RETURN NEW;
    END IF;

    -- Resolve email from billing_address or metadata
    v_clean_email := lower(trim(coalesce(
        NEW.billing_address->>'email',
        NEW.metadata->>'customer_email'
    )));

    IF v_clean_email IS NULL OR v_clean_email = '' THEN
        -- LIMIT 1 is load-bearing: `p.id = NEW.user_id OR p.user_id = NEW.user_id`
        -- can match two rows for the same person, and `SELECT … INTO` without a
        -- limit takes whichever the planner returns first.
        SELECT lower(trim(p.email)) INTO v_clean_email
        FROM public.profiles p
        WHERE p.id = NEW.user_id OR p.user_id = NEW.user_id
        LIMIT 1;
    END IF;

    IF v_clean_email IS NULL OR v_clean_email = '' THEN
        RETURN NEW;
    END IF;

    v_cents := coalesce((NEW.total * 100)::integer, 0);

    -- Upsert contact WITHOUT touching the donation total. The amount is applied
    -- once, below, only when this order's activity row does not exist yet.
    -- Incrementing here instead would double-count on any re-fire — and this
    -- trigger is `AFTER INSERT OR UPDATE OF status`, so a status churn re-runs it
    -- against an order already counted.
    INSERT INTO public.crm_contacts (
        email,
        source,
        status,
        tags,
        total_donated_cents,
        created_at,
        updated_at
    ) VALUES (
        v_clean_email,
        'store_order',
        'donor',
        ARRAY['donor'],
        0,
        NEW.created_at,
        now()
    )
    ON CONFLICT (email) DO UPDATE
    SET
        status = CASE
            WHEN public.crm_contacts.status = 'supporter' THEN 'donor'
            ELSE public.crm_contacts.status
        END,
        tags = CASE
            WHEN 'donor' = ANY(public.crm_contacts.tags) THEN public.crm_contacts.tags
            ELSE array_append(public.crm_contacts.tags, 'donor')
        END,
        updated_at = now()
    RETURNING id INTO v_contact_id;

    -- First time we see this order → record activity AND apply the amount once.
    IF NOT EXISTS (
        SELECT 1 FROM public.crm_activities
        WHERE contact_id = v_contact_id
          AND type = 'order'
          AND (metadata->>'order_id')::integer = NEW.id
    ) THEN
        INSERT INTO public.crm_activities (
            contact_id,
            type,
            title,
            description,
            metadata,
            created_at
        ) VALUES (
            v_contact_id,
            'order',
            'Store Order #' || NEW.id,
            'Purchased merchandise / grassroots donation: $' || coalesce(NEW.total::text, '0'),
            jsonb_build_object('order_id', NEW.id, 'total', NEW.total),
            NEW.created_at
        );

        UPDATE public.crm_contacts
        SET total_donated_cents = total_donated_cents + v_cents,
            updated_at = now()
        WHERE id = v_contact_id;
    END IF;

    RETURN NEW;
END;
$$;

-- The triggers already exist and are attached to the right tables and events;
-- `CREATE OR REPLACE` on a function preserves the existing trigger binding, so
-- nothing needs re-issuing. Asserted rather than assumed — a trigger that failed
-- to attach leaves a table silently unsynced, which is the failure mode this
-- whole file exists to prevent.
DO $$
DECLARE
    missing text;
BEGIN
    SELECT string_agg(t.expected, ', ')
    INTO missing
    FROM (VALUES
        ('trg_sync_contact_submission_to_crm'),
        ('trg_sync_profile_to_crm'),
        ('trg_sync_order_to_crm')
    ) AS t(expected)
    WHERE NOT EXISTS (
        SELECT 1
        FROM pg_trigger tg
        JOIN pg_class c ON c.oid = tg.tgrelid
        WHERE tg.tgname = t.expected
          AND NOT tg.tgisinternal
    );

    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'CRM sync triggers missing after recreate: %', missing;
    END IF;
END;
$$;
