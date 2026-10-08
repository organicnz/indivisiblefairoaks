-- Purge expired rate-limit rows.
--
-- search_rate_limit is insert-per-request (search, checkout, WALL-E) with no
-- deletes: the rolling-window counts only look back minutes, so every row
-- older than the retention window is dead weight — unbounded growth on a
-- table indexed per IP, on a project billed for Disk IO. The 20260904130000
-- comment claims the edge functions purge; they never did (insert + count
-- only), so the purge lives here as a nightly pg_cron job instead.
--
-- 7 days is generous on purpose: every enforcement window in the edge
-- functions is minute-scale. Anything older cannot influence a decision and
-- exists only for forensics.
--
-- Idempotent: cron.schedule upserts on job_name, so re-applying this
-- migration updates the schedule rather than duplicating it.

create extension if not exists pg_cron;

select cron.schedule(
  'prune-search-rate-limit',
  '0 4 * * *',
  $$delete from public.search_rate_limit where created_at < now() - interval '7 days'$$
);
