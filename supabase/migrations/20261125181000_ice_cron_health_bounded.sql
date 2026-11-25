-- The deploy-time watchdog reads `ice_cron_health` through PostgREST, whose
-- statement timeout is eight seconds. The first definition sorted every row in
-- `cron.job_run_details` for each ICE job with a lateral `order by … limit 1`;
-- on a project with months of job history that read was cancelled with 57014
-- and the scanner looked unobservable exactly when the probe mattered.
--
-- Bound the scan to a recent window and pick the latest run per job once with
-- `distinct on`, so the plan is a single filtered sort rather than one
-- unbounded sort per job. Seven days is far wider than any freshness budget
-- the watchdog enforces; a job that has not run in a week is reported as having
-- no recent run, which is itself the finding.
create or replace view public.ice_cron_health as
with ice_jobs as (
  select j.jobid, j.jobname, j.schedule, j.active
    from cron.job j
   where j.jobname like 'ice-%'
),
latest as (
  select distinct on (d.jobid)
         d.jobid,
         d.status,
         d.start_time,
         d.end_time,
         d.return_message
    from cron.job_run_details d
   where d.jobid in (select jobid from ice_jobs)
     and d.start_time > now() - interval '7 days'
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
  'Latest pg_cron run per ICE job within seven days. Service-role only; bounded so PostgREST can read it.';

notify pgrst, 'reload schema';
