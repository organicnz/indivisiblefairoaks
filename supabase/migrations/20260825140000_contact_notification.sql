-- Contact form email delivery.
--
-- The contact form inserts into `contact_submissions` and nothing consumed the
-- table: no email, no admin UI. Customer messages (including two real trade
-- inquiries) sat unread for weeks. This wires an email notification onto the
-- existing insert — no new write path, no secrets in SQL.
--
-- Architecture (secrets follow code — all credentials live in Edge Function
-- secrets, which Postgres deliberately cannot read):
--   AFTER INSERT trigger -> pg_net POSTs { id } to notify-contact -> the Edge
--   Function re-reads the row with its service-role key, atomically claims it
--   via contact_submissions.email_sent_at (exactly one notification per row,
--   ever), then sends via Resend. The payload carries no row data, so callers
--   can never inject arbitrary email content.
--
-- Failure posture:
--   - Email is fire-and-forget (pg_net). Delivery outcomes land in
--     net._http_response; the submission row itself is the source of truth
--     and never depends on the email succeeding.
--   - Any error in the trigger is swallowed (WARNING only): a broken function
--     deploy must never 500 the customer's form submit.
--
-- Mail-bomb resistance: RLS permits anonymous inserts, so the public anon key
-- could be scripted to generate rows (and thus notifications). The throttle
-- below caps trigger volume; the atomic claim caps replays of a single row.

ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_contact_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Throttle guard: cap at ~6 dispatches per rolling 10 minutes; submissions
  -- still persist regardless.
  IF (
    SELECT count(*)
    FROM public.contact_submissions
    WHERE created_at > now() - interval '10 minutes'
  ) > 6 THEN
    RAISE WARNING 'contact notify throttled (volume window exceeded)';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := 'https://wcoaqlglwxwceqktpckt.supabase.co/functions/v1/notify-contact',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object('id', NEW.id)
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'contact notify dispatch failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_submissions_notify ON public.contact_submissions;
CREATE TRIGGER contact_submissions_notify
  AFTER INSERT ON public.contact_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_contact_submission();
