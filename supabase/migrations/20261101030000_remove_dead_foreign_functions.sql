-- Migration: 20261101030000_remove_dead_foreign_functions.sql
--
-- Three unrelated cleanups that the security advisor surfaced, all of them
-- about functions rather than tables. Earlier passes removed the foreign edge
-- functions and cron jobs that came from a different project sharing this
-- Supabase instance; this finishes the job inside the database itself.
--
-- ## 1. Six functions that cannot run
--
-- Each one is a leftover from that other project, and each references a table
-- that does not exist here:
--
--   function                        references
--   ------------------------------  --------------------------------------
--   get_user_org_id()               org_members
--   move_to_dlq()                   review_jobs, review_jobs_dlq
--   cleanup_old_audit_logs()        tool_audit_logs
--   is_service_role()               (none — generic JWT role probe)
--   update_pull_requests_updated_at()  (a trigger function with no trigger)
--   update_updated_at_column()      (a trigger function with no trigger)
--
-- `to_regclass` returns NULL for every one of those tables, so a call today
-- errors rather than doing anything. None is referenced by a trigger, a policy,
-- or another function (`pg_trigger`, `pg_policies`, and `prosrc` all return
-- zero). They are pure attack surface: `get_user_org_id` and `is_service_role`
-- are SECURITY DEFINER and executable by `anon` through
-- `/rest/v1/rpc/<name>`.
--
-- The two trigger functions are the duplicate pair that made this look
-- intentional: this project's real trigger is `touch_updated_at()`, used by
-- `content_media`, `crm_broadcasts`, `crm_contacts` and `crm_tasks`. Neither
-- of the two being dropped is attached to anything.
--
-- ## 2. crm_stats() was reachable by every signed-in user
--
-- The CRM tables are admin-only — `crm_contacts`, `crm_tasks`, `crm_broadcasts`,
-- `crm_segments` and `crm_activities` all gate SELECT on `is_admin()`. But
-- `crm_stats()` is SECURITY DEFINER and carried an explicit EXECUTE grant to
-- `authenticated`, so any chapter member with an account could call
-- `/rest/v1/rpc/crm_stats` and read total contacts, active volunteers, local
-- district counts, donor counts and total donations — the aggregate the tables
-- themselves refuse to show them.
--
-- The only caller is `src/lib/actions/crm.ts`, which uses the service-role
-- client (`adminClient.rpc('crm_stats')`), so the admin surface keeps working
-- and the grant is what was wrong.
--
-- ## 3. decrement_stock() had a mutable search_path
--
-- The function body is a documented placeholder (no table access at all), so
-- pinning the path is a pure hardening step with no behavioural change. The
-- project already pins `search_path` on `is_admin()` and the other definer
-- functions.
--
-- Note: `pg_net` remains installed in `public`, as the advisor also reports.
-- Moving an extension is not a schema tidy-up — it changes where `net.http_post`
-- resolves for the live cron job — so it is deliberately left alone.

DROP FUNCTION IF EXISTS public.get_user_org_id();
DROP FUNCTION IF EXISTS public.is_service_role();
DROP FUNCTION IF EXISTS public.move_to_dlq();
DROP FUNCTION IF EXISTS public.cleanup_old_audit_logs();
DROP FUNCTION IF EXISTS public.update_pull_requests_updated_at();
DROP FUNCTION IF EXISTS public.update_updated_at_column();

REVOKE EXECUTE ON FUNCTION public.crm_stats() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.decrement_stock(integer, integer) SET search_path = '';
