-- The deploy-time watchdog reads `ice_cron_health` through PostgREST, whose
-- statement timeout is eight seconds.
--
-- The first definition sorted every row in `cron.job_run_details` once per ICE
-- job. A seven-day predicate did not fix it: the table has no index on
-- `start_time`, so it still seq-scanned the whole history — including the wide
-- `return_message` column — and the read was still cancelled with 57014.
--
-- Bound by `runid` instead. It is the table's primary key, so `max(runid)` and
-- the range scan are index reads, and 25,000 recent runs is roughly three weeks
-- for this project's scanner jobs — far wider than any freshness budget the
-- watchdog enforces. A job that has not run in that window reports no recent
-- run, which is itself the finding.
create or replace view public.ice_cron_health as
with ice_jobs as (
  select j.jobid, j.jobname, j.schedule, j.active
    from cron.job j
   where j.jobname like 'ice-%'
),
recent as (
  select d.jobid,
         d.status,
         d.start_time,
         d.end_time,
         d.return_message
    from cron.job_run_details d
   where d.jobid in (select jobid from ice_jobs)
     and d.runid > coalesce((select max(runid) from cron.job_run_details), 0) - 25000
),
latest as (
  select distinct on (d.jobid)
         d.jobid,
         d.status,
         d.start_time,
         d.end_time,
         d.return_message
    from recent d
   order by d.jobid, d.start_time desc
)
select
  j.jobid,
  j.jobname,
  j.schedule,
  j.active,
  r.status as last_status,
  r.start_time as last_start,
  r.end_time as last_end,
  left(coalesce(r.return_message, ''), 300) as last_message
from ice_jobs j
left join latest r on r.jobid = j.jobid;

revoke all on public.ice_cron_health from public, anon, authenticated;
grant select on public.ice_cron_health to service_role;

comment on view public.ice_cron_health is
  'Latest pg_cron run per ICE job within the recent runid window. Service-role only; bounded so PostgREST can read it.';

notify pgrst, 'reload schema';
