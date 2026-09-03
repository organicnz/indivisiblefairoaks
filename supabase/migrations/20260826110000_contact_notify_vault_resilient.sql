-- Make contact notification URL vault-overridable.
--
-- The original 20260825140000 migration hardcodes the Supabase function URL.
-- That is correct for the current project but bakes in the project ref:
-- a restore to a new ref or a fork would silently stop notifying without a
-- code deploy. Vault is the project's secret store (see AGENTS.md): operators
-- can now rotate the endpoint with a secret instead of a migration:
--
--   supabase secrets set contact_notify_url=https://<new-ref>.supabase.co/functions/v1/notify-contact
--
-- Resolution order:
--   1. vault.decrypted_secrets.contact_notify_url (if vault schema exists)
--   2. hardcoded fallback (current project)
--
-- The lookup is best-effort and fully swallowed: a missing vault schema,
-- a missing secret, or a vault permission error never blocks the customer's
-- form submit — the row still persists, the trigger just logs a WARNING.
-- Throttle semantics are unchanged.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_contact_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  notify_url text := 'https://wcoaqlglwxwceqktpckt.supabase.co/functions/v1/notify-contact';
  vault_url text;
BEGIN
  -- Best-effort vault override (operators can rotate the function URL without
  -- shipping a new migration — just set the vault secret and replenish the
  -- function's env if needed).
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'vault') THEN
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

DROP TRIGGER IF EXISTS contact_submissions_notify ON public.contact_submissions;
CREATE TRIGGER contact_submissions_notify
  AFTER INSERT ON public.contact_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_contact_submission();
