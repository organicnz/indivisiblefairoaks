-- Cron cleanup: remove eight jobs this project never defined.
--
-- Audited 2026-11-01 against `cron.job` and `cron.job_run_details`. Every job
-- below references something that does not exist in this database, or targets
-- another project's deployed code:
--
--   cleanup-audit-logs   DELETE FROM audit_logs            → relation does not exist
--   cleanup-tool-audit   SELECT cleanup_old_audit_logs()   → relation "tool_audit_logs" does not exist
--   cleanup-dlq          SELECT move_to_dlq()              → relation "review_jobs_dlq" does not exist
--   poll-repos           500 on every run, every 5 minutes
--   process-queue        no-op, every minute
--   scan-repos           targets another project's function
--   scan-repos-weekly    same
--   invoke-keepalive-6h  POSTs /functions/v1/keepalive, which is not deployed (404)
--
-- The three cleanup jobs have failed on every scheduled run since at least
-- 2026-10-17 — 2 of 2 runs in the retention window, each with "relation does not
-- exist". poll-repos was 72 of the 72 failed HTTP responses in the ~6h window
-- `net._http_response` retains.
--
-- None of these functions or tables appears anywhere in this repository's
-- migrations. The three repo-built functions that these jobs call are deployed
-- from `/home/organic/dev/foodshare-ai/supabase/functions/…` — another
-- project's code, still ACTIVE here and deployed with `verify_jwt: false`.
--
-- Two of the jobs also embed credentials in plaintext in `cron.job.command`: a
-- bearer token and a second literal. `cron.job` is an ordinary table, so a
-- literal there is a stored secret, not a reference to one. This project's own
-- convention is the Vault form used by `sync-mobilize-events` (kept below):
-- `cron.job.command` reads `decrypted_secrets` at run time.
--
-- Removing the job removes the command, and with it the embedded tokens.
--
-- Kept, because this repository defines them and they succeed:
--   prune-error-reports    (public.error_reports)
--   prune-search-rate-limit(public.search_rate_limit)
--   sync-mobilize-events   (Vault-backed)
--
-- Recreating one is `cron.schedule('<name>', '<schedule>', $$<command>$$)`; the
-- exact commands are quoted in the commit that introduced this file.

do $$
declare
  j record;
begin
  for j in
    select jobid, jobname
      from cron.job
     where jobname in (
       'cleanup-audit-logs',
       'cleanup-tool-audit',
       'cleanup-dlq',
       'poll-repos',
       'process-queue',
       'scan-repos',
       'scan-repos-weekly',
       'invoke-keepalive-6h'
     )
  loop
    perform cron.unschedule(j.jobid);
    raise notice 'unscheduled % (jobid %)', j.jobname, j.jobid;
  end loop;
end
$$;
