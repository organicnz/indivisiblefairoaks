-- Final-state enforcement for the contact dispatch redesign.
--
-- History of the dispatch mechanism:
--   20260825140000 created a pg_net AFTER-INSERT trigger (fire-and-forget).
--   The design was superseded by direct invocation from the server action,
--   which awaits {emailed, copied} so the UI can report real delivery status.
--
-- This migration is intentionally LAST in the chain: it removes everything
-- the trigger approach installed, leaving direct invocation as the only
-- dispatch path. pg_net is dropped with it — nothing else in this project
-- consumes it (verified by grep over supabase/migrations at commit time).

DROP TRIGGER IF EXISTS contact_submissions_notify ON public.contact_submissions;
DROP FUNCTION IF EXISTS public.notify_contact_submission();
DROP EXTENSION IF EXISTS pg_net;
