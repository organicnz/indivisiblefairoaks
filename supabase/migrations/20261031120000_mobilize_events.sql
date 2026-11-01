-- Issue #153 — pull the chapter's Mobilize events onto /events automatically.
--
-- The chapter has no Mobilize organization of its own; every event the site
-- links (1011420, 1072857, 903494, 967302) is sponsored by the *national*
-- Indivisible org (id 93). So "watch the org feed" is not a filter — org 93 has
-- thousands of events nationwide. The scope therefore lives in
-- `mobilize_settings`: org-owned only, within a radius of the chapter's ZIP,
-- narrowed to a locality allowlist, virtual events off unless a human pins one.
--
-- The sync is an Edge Function (`sync-mobilize-events`) invoked by pg_cron via
-- pg_net, because it is an unattended job that must write with the service
-- role. The scheduling half of this file is the one place this repository puts
-- the service key in Postgres, which `supabase/functions/secrets.manifest.mjs`
-- already anticipated: it documents Vault as unused *because* every consumer is
-- an edge function, and says Vault "would be worth revisiting if a server-side
-- consumer ever needed a secret — a Postgres function or trigger, say". A
-- pg_cron job is exactly that consumer.
--
-- Setup (once, per project): `bun scripts/seed-mobilize-cron.mjs`
-- until then the scheduled command is a no-op — it reads the key from Vault at
-- run time and posts nothing when the secret is absent. The key is never
-- written into `cron.job.command`.

-- ── 1. events: provenance, lifecycle, and a fifth category ───────────────────

alter table public.events
  add column if not exists source text not null default 'manual',
  add column if not exists external_id text,
  add column if not exists external_url text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists is_hidden boolean not null default false,
  add column if not exists sync_locked boolean not null default false;

alter table public.events drop constraint if exists events_source_check;
alter table public.events
  add constraint events_source_check check (source in ('manual', 'mobilize'));

-- A plain unique column, deliberately not a partial index: PostgREST's
-- `onConflict` becomes `ON CONFLICT (external_id)`, and a partial index's
-- predicate is not inferable from that. Postgres treats NULLs as distinct, so
-- every manual row may keep its external_id NULL.
create unique index if not exists events_external_id_key
  on public.events (external_id);

-- Mobilize's event types (COMMUNITY, POSTCARD_WRITING, WORKSHOP, …) do not fit
-- the four editorial categories. Miscategorising them would also make an
-- imported "Sing IN" indistinguishable from a chapter meeting in the filter
-- chips. The fifth value is what lets the mapper say "Community" honestly.
alter table public.events drop constraint if exists events_category_check;
alter table public.events
  add constraint events_category_check
  check (category in (
    'Meetings',
    'Resistance Choir',
    'Voter Mobilization',
    'Rallies & Street Action',
    'Community'
  ));

comment on column public.events.external_id is
  'Mobilize event id for rows the sync owns. NULL on every hand-made row.';
comment on column public.events.is_hidden is
  'Hidden from every public read. The sync sets it on a 404 and never clears it.';
comment on column public.events.sync_locked is
  'Set when an admin edits a Mobilize-sourced row; the sync then skips it entirely.';

-- ── 2. mobilize_settings — the scope, as data ────────────────────────────────

create table if not exists public.mobilize_settings (
  id                 int primary key default 1 check (id = 1),
  enabled            boolean not null default true,
  org_id             int not null default 93,
  zipcode            text not null default '95608',
  max_dist           int not null default 25 check (max_dist between 1 and 100),
  locality_allowlist text[] not null default array[
    'Sacramento', 'Carmichael', 'Fair Oaks', 'Citrus Heights', 'Orangevale',
    'Rancho Cordova', 'North Highlands', 'Antelope', 'Folsom', 'Gold River'
  ],
  include_virtual    boolean not null default false,
  high_priority_only boolean not null default false,
  auto_publish       boolean not null default true,
  updated_at         timestamptz not null default now()
);

comment on table public.mobilize_settings is
  'Singleton scope for the Mobilize sync (issue #153). Edited from /admin/events → Mobilize.';
comment on column public.mobilize_settings.locality_allowlist is
  'The only geographic truth: the API filters by radius, this narrows it to the chapter''s cities.';
comment on column public.mobilize_settings.high_priority_only is
  'Mobilize''s "pinned" flag. Returns 0 events in this area at launch — audited rather than assumed.';

-- ── 3. mobilize_event_rules — the per-event answer ───────────────────────────
-- "Which events to pick up" is a human decision that has to survive the next
-- sync. `exclude` outranks every filter; `pin` outranks them in the other
-- direction, which is how a single national virtual call gets included without
-- opening up the other 51.

create table if not exists public.mobilize_event_rules (
  external_id text primary key,
  action      text not null check (action in ('pin', 'exclude')),
  note        text not null default '',
  created_at  timestamptz not null default now()
);

-- ── 4. mobilize_sync_runs — the only durable evidence a run happened ─────────
-- Supabase Free keeps Edge Function logs for one day. A failure nobody noticed
-- on the day would otherwise leave no record at all, which is the failure mode
-- every gate in this repository exists to avoid.

create table if not exists public.mobilize_sync_runs (
  id          bigint generated by default as identity primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  checked     int not null default 0,
  imported    int not null default 0,
  updated     int not null default 0,
  hidden      int not null default 0,
  filtered    int not null default 0,
  error       text
);

create index if not exists mobilize_sync_runs_started_idx
  on public.mobilize_sync_runs (started_at desc);

-- ── 5. Access ────────────────────────────────────────────────────────────────
-- Service role only. RLS on with no policies denies anon/authenticated by
-- default; the explicit revokes make that a statement rather than a side effect
-- of remembering to stay silent.

alter table public.mobilize_settings    enable row level security;
alter table public.mobilize_event_rules enable row level security;
alter table public.mobilize_sync_runs   enable row level security;

revoke all on public.mobilize_settings    from anon, authenticated;
revoke all on public.mobilize_event_rules from anon, authenticated;
revoke all on public.mobilize_sync_runs   from anon, authenticated;

-- ── 6. Seed the scope ────────────────────────────────────────────────────────
-- `on conflict do nothing` so a re-run never resets an organizer's edits.

insert into public.mobilize_settings (id)
values (1)
on conflict (id) do nothing;

-- ── 7. Schedule ──────────────────────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 30 minutes: events change rarely, and the function refreshes every imported
-- row on each pass, so a changed time or venue lands inside half an hour.
--
-- The command resolves both values from Vault at run time. That is deliberate —
-- interpolating them here would copy the service key into `cron.job.command`,
-- where it would sit in plaintext for the life of the job. The `where exists`
-- clause makes an unconfigured project a no-op instead of a job that fails
-- every 30 minutes.
select cron.schedule(
  'sync-mobilize-events',
  '*/30 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'mobilize_project_url')
           || '/functions/v1/sync-mobilize-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'mobilize_service_key'),
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'mobilize_service_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
  where exists (
    select 1 from vault.decrypted_secrets where name = 'mobilize_service_key'
  );
  $job$
);
