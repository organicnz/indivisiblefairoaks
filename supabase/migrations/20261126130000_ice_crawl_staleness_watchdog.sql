-- The approved-source crawl is driven by pg_cron (`ice-source-crawl`) through
-- /api/ice-crawl/run. It previously updated only per-source timestamps, so a
-- scheduler that stopped firing left no aggregate evidence and nothing for a
-- watchdog to alert on. Each bounded invocation now records one tick here; the
-- edge scan keeps its own `ice_scan_runs` table.
create table if not exists public.ice_crawl_ticks (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('ok', 'degraded', 'failed', 'skipped')),
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  duration_ms integer not null check (duration_ms >= 0),
  sources integer not null default 0 check (sources >= 0),
  reports integer not null default 0 check (reports >= 0),
  errors jsonb not null default '[]'::jsonb check (jsonb_typeof(errors) = 'array'),
  created_at timestamptz not null default now()
);

create index if not exists ice_crawl_ticks_success_idx
  on public.ice_crawl_ticks (finished_at desc)
  where status in ('ok', 'degraded');

alter table public.ice_crawl_ticks enable row level security;
revoke all on table public.ice_crawl_ticks from public, anon, authenticated;
grant select, insert on table public.ice_crawl_ticks to service_role;

comment on table public.ice_crawl_ticks is
  'One bounded scheduled approved-source crawl tick. Service-role only.';

-- Durable operational alerts. `fingerprint` is stable per condition, so the
-- watchdog upserts instead of appending a row every twenty minutes. Resolving
-- sets `resolved_at`; a recurrence reopens the same row and keeps its original
-- `first_seen_at`.
create table if not exists public.ice_operational_alerts (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique check (fingerprint ~ '^[a-z0-9-]{1,80}$'),
  kind text not null check (kind ~ '^[a-z0-9-]{1,80}$'),
  severity text not null check (severity in ('warning', 'critical')),
  message text not null check (length(message) between 1 and 1000),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists ice_operational_alerts_active_idx
  on public.ice_operational_alerts (last_seen_at desc)
  where resolved_at is null;

alter table public.ice_operational_alerts enable row level security;
revoke all on table public.ice_operational_alerts from public, anon, authenticated;
grant select, insert, update on table public.ice_operational_alerts to service_role;

comment on table public.ice_operational_alerts is
  'Durable, fingerprint-deduplicated operational alerts. Service-role only.';

/**
 * One row of truth for the crawl and discovery schedules. Timestamps are raw
 * so the watchdog and `/api/health` apply the same windows in application code
 * rather than hard-coding two different definitions of "stale" in SQL.
 */
create or replace view public.ice_crawl_health as
with crawl as (
  select
    (select max(t.finished_at)
       from public.ice_crawl_ticks t
      where t.status in ('ok', 'degraded')) as last_source_crawl_at,
    (select max(t.finished_at)
       from public.ice_crawl_ticks t) as last_source_crawl_attempt_at,
    (select t.status
       from public.ice_crawl_ticks t
      order by t.finished_at desc
      limit 1) as last_source_crawl_status,
    (select t.reports
       from public.ice_crawl_ticks t
      order by t.finished_at desc
      limit 1) as last_source_crawl_reports
),
scan as (
  select
    (select max(r.finished_at)
       from public.ice_scan_runs r
      where r.job in ('discover', 'both')
        and r.status in ('ok', 'degraded')) as last_discovery_at,
    (select max(r.finished_at)
       from public.ice_scan_runs r
      where r.status in ('ok', 'degraded')) as last_scan_at
)
select
  crawl.last_source_crawl_at,
  crawl.last_source_crawl_attempt_at,
  crawl.last_source_crawl_status,
  crawl.last_source_crawl_reports,
  scan.last_discovery_at,
  scan.last_scan_at,
  coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'kind', a.kind,
               'severity', a.severity,
               'message', a.message,
               'last_seen_at', a.last_seen_at
             )
             order by a.last_seen_at desc
           )
      from public.ice_operational_alerts a
     where a.resolved_at is null
  ), '[]'::jsonb) as active_alerts,
  (select count(*)
     from public.ice_operational_alerts a
    where a.resolved_at is null) as active_alert_count,
  now() as checked_at
from crawl, scan;

revoke all on public.ice_crawl_health from public, anon, authenticated;
grant select on public.ice_crawl_health to service_role;

comment on view public.ice_crawl_health is
  'Last successful source crawl and discovery ticks plus active operational alerts. Service-role only.';

notify pgrst, 'reload schema';
