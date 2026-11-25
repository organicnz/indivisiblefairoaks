-- The ICE scan moved from two Next.js cron routes into one Supabase edge
-- function (`ice-scan`) so the scanner lives next to the source of truth.
-- This migration adds the operational state that makes that move safe:
--
--   * `ice_scan_runs`      one row per bounded discover/intake invocation,
--   * `ice_scan_leases`    a cross-worker lock so overlapping cron/watchdog
--                          ticks cannot double-spend model calls,
--   * attempt accounting   so a permanently failing publisher rotates out of
--                          the queue instead of consuming it forever,
--   * health views         a service-role-only read of run freshness and the
--                          actual pg_cron job state (not just "the job exists").
--
-- It deliberately does not schedule anything. The Vault secret + pg_cron
-- statements stay in `scripts/seed-ice-alert-cron.mjs`, which is idempotent and
-- is run by the deploy workflow after both the function and this migration are
-- in place.

alter table public.ice_crawl_discoveries
  add column if not exists attempt_count integer not null default 0;

do $constraint$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.ice_crawl_discoveries'::regclass
       and conname = 'ice_crawl_discoveries_attempt_count_check'
  ) then
    alter table public.ice_crawl_discoveries
      add constraint ice_crawl_discoveries_attempt_count_check
      check (attempt_count >= 0);
  end if;
end
$constraint$;

create table if not exists public.ice_scan_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null check (job in ('discover', 'intake', 'both')),
  mode text not null check (mode in ('discover', 'intake', 'both')),
  status text not null default 'running'
    check (status in ('running', 'ok', 'degraded', 'failed', 'skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  found integer not null default 0 check (found >= 0),
  queued integer not null default 0 check (queued >= 0),
  processed integer not null default 0 check (processed >= 0),
  reports integer not null default 0 check (reports >= 0),
  duplicates integer not null default 0 check (duplicates >= 0),
  rejected integer not null default 0 check (rejected >= 0),
  retried integer not null default 0 check (retried >= 0),
  images integer not null default 0 check (images >= 0),
  remaining integer check (remaining is null or remaining >= 0),
  errors jsonb not null default '[]'::jsonb check (jsonb_typeof(errors) = 'array'),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object')
);

create index if not exists ice_scan_runs_started_idx
  on public.ice_scan_runs (started_at desc);
create index if not exists ice_scan_runs_job_finished_idx
  on public.ice_scan_runs (job, finished_at desc);

alter table public.ice_scan_runs enable row level security;
revoke all on table public.ice_scan_runs from anon, authenticated;
grant select, insert, update on table public.ice_scan_runs to service_role;

comment on table public.ice_scan_runs is
  'One bounded invocation of the ice-scan edge function. Service-role only.';

create table if not exists public.ice_scan_leases (
  job text primary key check (job ~ '^[a-z0-9-]{1,40}$'),
  locked_until timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.ice_scan_leases enable row level security;
revoke all on table public.ice_scan_leases from anon, authenticated;
grant select, insert, update, delete on table public.ice_scan_leases to service_role;

comment on table public.ice_scan_leases is
  'Expiring cross-worker lease for each ice-scan phase. Service-role only.';

/**
 * Claim a phase lease. An expired lease can be taken over, which is what makes
 * a killed worker self-healing instead of permanently wedging the scanner.
 */
create or replace function public.ice_scan_claim(
  p_job text,
  p_lease_seconds integer default 120
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claimed_job text;
begin
  if p_job is null or p_job !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'ice_scan_claim: invalid job name';
  end if;

  insert into public.ice_scan_leases as lease (job, locked_until, updated_at)
  values (
    p_job,
    now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 120), 600))),
    now()
  )
  on conflict (job) do update
    set locked_until = excluded.locked_until,
        updated_at = now()
    where lease.locked_until < now()
  returning job into claimed_job;

  return claimed_job is not null;
end;
$$;

revoke all on function public.ice_scan_claim(text, integer) from public, anon, authenticated;
grant execute on function public.ice_scan_claim(text, integer) to service_role;

create or replace function public.ice_scan_release(p_job text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.ice_scan_leases where job = p_job;
$$;

revoke all on function public.ice_scan_release(text) from public, anon, authenticated;
grant execute on function public.ice_scan_release(text) to service_role;

/**
 * Record one transient intake failure and retire the candidate after the
 * attempt ceiling. The decision lives in SQL so the edge function and the
 * Next.js fallback cannot disagree about when a poison row stops consuming
 * the queue.
 */
create or replace function public.record_ice_discovery_attempt(
  p_id uuid,
  p_note text,
  p_max_attempts integer default 6
)
returns table (status text, attempt_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  next_count integer;
  max_attempts integer := greatest(1, least(coalesce(p_max_attempts, 6), 20));
begin
  update public.ice_crawl_discoveries as d
     set attempt_count = d.attempt_count + 1,
         last_attempt_at = now(),
         review_note = left(coalesce(nullif(p_note, ''), 'auto retry'), 500),
         status = case
           when d.attempt_count + 1 >= max_attempts then 'rejected'
           else d.status
         end,
         reviewed_at = case
           when d.attempt_count + 1 >= max_attempts then now()
           else null
         end
   where d.id = p_id
     and d.status = 'pending'
   returning d.attempt_count into next_count;

  if next_count is null then
    return;
  end if;

  return query
    select d.status, d.attempt_count
      from public.ice_crawl_discoveries d
     where d.id = p_id;
end;
$$;

revoke all on function public.record_ice_discovery_attempt(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.record_ice_discovery_attempt(uuid, text, integer)
  to service_role;

-- A discovery report is read by the admin rights queue; the image URL is the
-- idempotence key for evidence capture. Both lookups were sequential scans.
create index if not exists ice_source_reports_discovery_rights_idx
  on public.ice_source_reports (provenance, rights_status, published_at desc);
create index if not exists ice_crawl_page_images_image_url_idx
  on public.ice_crawl_page_images (image_url);

/**
 * One row of operational truth for the scanner. Timestamps are raw so the
 * watchdog can choose its own freshness budget; the dashboard and CLI read the
 * same view instead of inventing a second definition of "alive".
 */
create or replace view public.ice_scan_health as
select
  (select max(r.finished_at)
     from public.ice_scan_runs r
    where r.status in ('ok', 'degraded')) as last_finished_at,
  (select max(r.finished_at)
     from public.ice_scan_runs r
    where r.job in ('discover', 'both')
      and r.status in ('ok', 'degraded')) as last_discovery_at,
  (select max(r.finished_at)
     from public.ice_scan_runs r
    where r.job in ('intake', 'both')
      and r.status in ('ok', 'degraded')) as last_intake_at,
  (select count(*)
     from public.ice_crawl_discoveries d
    where d.status = 'pending') as pending_discoveries,
  (select count(*)
     from public.ice_source_reports s
    where s.provenance = 'discovery'
      and s.rights_status = 'unconfirmed') as unconfirmed_reports,
  (select count(*)
     from public.ice_crawl_page_images i) as evidence_images,
  (select max(i.created_at)
     from public.ice_crawl_page_images i) as last_image_at,
  (select max(r.started_at)
     from public.ice_scan_runs r
    where r.status = 'failed') as last_failed_at,
  now() as checked_at;

revoke all on public.ice_scan_health from public, anon, authenticated;
grant select on public.ice_scan_health to service_role;

comment on view public.ice_scan_health is
  'ICE scan freshness, backlog and evidence counts. Service-role only.';

/**
 * The scheduler is only healthy if pg_cron is actually running the jobs, so
 * surface the last run state rather than assuming that a schedule exists.
 */
create or replace view public.ice_cron_health as
select
  j.jobid,
  j.jobname,
  j.schedule,
  j.active,
  r.status as last_status,
  r.start_time as last_start,
  r.end_time as last_end,
  left(coalesce(r.return_message, ''), 300) as last_message
from cron.job j
left join lateral (
  select d.status, d.start_time, d.end_time, d.return_message
    from cron.job_run_details d
   where d.jobid = j.jobid
   order by d.start_time desc
   limit 1
) r on true
where j.jobname like 'ice-%';

revoke all on public.ice_cron_health from public, anon, authenticated;
grant select on public.ice_cron_health to service_role;

comment on view public.ice_cron_health is
  'Latest pg_cron run per ICE job. Service-role only; the scheduler is the other half of scan health.';

-- PostgREST caches the exposed schema. Without this, the new health views can
-- be absent from the REST surface until the next spontaneous reload, which is
-- exactly when the deploy-time watchdog tries to read them.
notify pgrst, 'reload schema';
