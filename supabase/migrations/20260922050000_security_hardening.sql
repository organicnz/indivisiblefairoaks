-- Security hardening: profiles priv-esc, coupons enumeration, direct-insert bypass.
-- Follows supabase-postgres-best-practices security-* rules:
--   UPDATE policies require USING + WITH CHECK; TO alone is not authorization.

-- ── 1. Profiles: block is_admin self-write ──────────────────────────────────
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = id
        OR auth.uid() = user_id
        OR (email IS NOT NULL AND auth.jwt()->>'email' = email)
    )
    WITH CHECK (
        (
            auth.uid() = id
            OR auth.uid() = user_id
            OR (email IS NOT NULL AND auth.jwt()->>'email' = email)
        )
        -- Non-admins may never promote a row to admin. Admins (is_admin())
        -- may set it freely (e.g. markAdminUser via service_role bypasses RLS anyway).
        AND (is_admin = false OR public.is_admin())
    );

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (
        (auth.uid() = id OR auth.uid() = user_id)
        AND (is_admin = false OR public.is_admin())
    );

-- Defense-in-depth trigger: even if a policy is misconfigured, is_admin
-- can only transition to true when the caller is already an admin.
CREATE OR REPLACE FUNCTION public.block_profiles_priv_esc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.is_admin IS TRUE AND (
        TG_OP = 'INSERT' OR OLD.is_admin IS DISTINCT FROM NEW.is_admin
    ) THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'is_admin escalation blocked';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_priv_esc ON public.profiles;
CREATE TRIGGER profiles_block_priv_esc
    BEFORE INSERT OR UPDATE OF is_admin ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.block_profiles_priv_esc();

-- ── 2. Coupons: revoke public enumeration, expose single-code RPC ───────────
DROP POLICY IF EXISTS "Anon validate coupon" ON public.coupons;
-- "Admins manage coupons" (USING is_admin) remains the only table policy.
REVOKE SELECT ON public.coupons FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_coupon(p_code text)
RETURNS TABLE (valid boolean, discount_type text, amount numeric, expiry_date timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_code text := upper(trim(COALESCE(p_code, '')));
BEGIN
    IF v_code = '' OR char_length(v_code) > 50 THEN
        RETURN QUERY SELECT false, NULL::text, NULL::numeric, NULL::timestamptz;
        RETURN;
    END IF;
    RETURN QUERY
    SELECT
        true,
        c.discount_type,
        c.amount,
        c.expiry_date
    FROM public.coupons c
    WHERE c.code = v_code
      AND (c.expiry_date IS NULL OR c.expiry_date > now())
    LIMIT 1;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::text, NULL::numeric, NULL::timestamptz;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_coupon(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text) TO anon, authenticated;

-- ── 3. Contact submissions: force RPC-only inserts ──────────────────────────
DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;
-- No direct INSERT policy remains: anon/authenticated must use
-- submit_contact_submission() (validated + globally throttled).
-- Admin SELECT policy is untouched.
ALTER TABLE public.contact_submissions ADD CONSTRAINT contact_name_len
    CHECK (char_length(name) BETWEEN 2 AND 100) NOT VALID;
ALTER TABLE public.contact_submissions ADD CONSTRAINT contact_email_len
    CHECK (char_length(email) <= 254) NOT VALID;
ALTER TABLE public.contact_submissions ADD CONSTRAINT contact_message_len
    CHECK (char_length(message) BETWEEN 10 AND 5000) NOT VALID;

-- ── 4. Error reports: keep insert-only but bound it ─────────────────────────
-- Table already has char_length + enum CHECKs (see canonical schema).
-- Add a per-minute flood guard at the DB layer so direct PostgREST inserts
-- can't bypass the 5/10min API limiter with DB-fill floods.
CREATE OR REPLACE FUNCTION public.check_error_report_flood()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF (
        SELECT count(*) FROM public.error_reports
        WHERE created_at > now() - interval '1 minute'
    ) >= 60 THEN
        RAISE EXCEPTION 'error report flood guard';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS error_reports_flood_guard ON public.error_reports;
CREATE TRIGGER error_reports_flood_guard
    BEFORE INSERT ON public.error_reports
    FOR EACH ROW EXECUTE FUNCTION public.check_error_report_flood();
