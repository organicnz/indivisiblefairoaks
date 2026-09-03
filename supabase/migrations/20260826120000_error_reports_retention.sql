-- Error beacon retention — prevent unbounded growth of the landing zone.
--
-- The error_reports table is append-only (anon insert, admin select) and
-- has no TTL. Left unchecked it would grow forever and eventually pressure
-- the free-tier storage quota. This schedules a daily prune via pg_cron
-- (Supabase's managed cron extension) to delete rows older than 90 days.
-- 90 days keeps enough history for triage while capping the working set.
--
-- If pg_cron is not available (local dev without the extension, or a fork
-- without superuser), the migration is still safe: the schedule step is
-- guarded and the table continues to work — it just won't auto-prune until
-- the extension is enabled. Manual DELETE remains available to admins via
-- the dashboard SQL editor at any time.

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $retention$
BEGIN
  -- Only schedule when pg_cron is actually installed (extension owner check).
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
