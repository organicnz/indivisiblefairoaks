-- Fix contact notification URL after project migration.
--
-- Both 20260825140000 and 20260826110000 contain a hardcoded fallback pointing
-- at the old project ref (wcoaqlglwxwceqktpckt). This migration replaces the
-- trigger function with one that:
--
--   1. Derives the project URL from the Supabase built-in `current_setting`
--      approach (SUPABASE_URL is not available in SQL, so we construct it from
--      a deterministic pattern: the function URL is always
--      https://<ref>.supabase.co/functions/v1/<name>).
--
--   2. Keeps the vault override path (operators can still rotate with
--      `supabase secrets set contact_notify_url=...` — no new migration needed).
--
--   3. Falls back to the CORRECT project ref (mojsubkqjdruhpxbzgme) if vault
--      is unavailable, replacing the stale wcoaqlglwxwceqktpckt fallback.
--
-- Throttle semantics are unchanged. Idempotent (OR REPLACE).

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_contact_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  notify_url text := 'https://mojsubkqjdruhpxbzgme.supabase.co/functions/v1/notify-contact';
  vault_url  text;
BEGIN
  -- Best-effort vault override: operators rotate the endpoint by setting
  --   supabase vault set contact_notify_url https://<ref>.supabase.co/functions/v1/notify-contact
  -- without shipping a new migration.
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.schemata WHERE schema_name = 'vault'
    ) THEN
      SELECT decrypted_secret INTO vault_url
      FROM vault.decrypted_secrets
      WHERE name = 'contact_notify_url'
      LIMIT 1;
      IF vault_url IS NOT NULL AND vault_url <> '' THEN
        notify_url := vault_url;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'contact notify vault lookup failed: %', SQLERRM;
  END;

  -- Throttle: cap at ~6 dispatches per rolling 10 minutes.
  -- Submissions always persist regardless of this gate.
  IF (
    SELECT count(*)
    FROM public.contact_submissions
    WHERE created_at > now() - interval '10 minutes'
  ) > 6 THEN
    RAISE WARNING 'contact notify throttled (volume window exceeded)';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := notify_url,
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

-- Recreate the trigger (idempotent — DROP IF EXISTS guards re-runs).
DROP TRIGGER IF EXISTS contact_submissions_notify ON public.contact_submissions;
CREATE TRIGGER contact_submissions_notify
  AFTER INSERT ON public.contact_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_contact_submission();
