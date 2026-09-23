-- Tighten the contact-form global throttle: 30 → 10 submissions / 10 min.
--
-- The RPC's own 30-cap stays as a backstop; this BEFORE INSERT trigger fires
-- on every insert path (RPC now, any future writers later) and wins the
-- min(). Legitimate traffic (~1/day) never notices. Mirrors the
-- error_reports flood-guard pattern. Shipped as its own migration (not an
-- edit of canonical) so history stays append-only.
CREATE OR REPLACE FUNCTION public.check_contact_submission_flood()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF (
        SELECT count(*) FROM public.contact_submissions
        WHERE created_at > now() - interval '10 minutes'
    ) >= 10 THEN
        RAISE EXCEPTION 'contact submission flood guard';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_submissions_flood_guard ON public.contact_submissions;
CREATE TRIGGER contact_submissions_flood_guard
    BEFORE INSERT ON public.contact_submissions
    FOR EACH ROW EXECUTE FUNCTION public.check_contact_submission_flood();
