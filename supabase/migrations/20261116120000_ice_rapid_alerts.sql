-- Hypothetical, private surge-alert delivery for /ice-alerts.
--
-- A subscriber row contains an email address, an optional state/city filter,
-- and an optional Web Push subscription. The public feed itself never reads
-- this table; only the service-role API routes do. RLS is enabled with no
-- policies, so anon/authenticated cannot select, insert, or enumerate rows.

create table if not exists public.ice_alert_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) between 3 and 320 and position('@' in email) > 1),
  email_normalized text generated always as (lower(btrim(email))) stored,
  state_code text check (state_code is null or state_code ~ '^[A-Z]{2}$'),
  city text check (city is null or length(city) between 1 and 80),
  email_opt_in boolean not null default true,
  push_opt_in boolean not null default false,
  push_subscription jsonb check (
    push_subscription is null or jsonb_typeof(push_subscription) = 'object'
  ),
  confirm_token uuid not null default gen_random_uuid(),
  unsubscribe_token uuid not null default gen_random_uuid(),
  confirmed_at timestamptz,
  confirmation_sent_at timestamptz,
  last_notified_at timestamptz,
  last_surge_key text,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ice_alert_subscribers_email_unique unique (email_normalized),
  constraint ice_alert_subscribers_confirm_token_unique unique (confirm_token),
  constraint ice_alert_subscribers_unsubscribe_token_unique unique (unsubscribe_token)
);

create index if not exists ice_alert_subscribers_area_idx
  on public.ice_alert_subscribers (state_code, city);
create index if not exists ice_alert_subscribers_confirmed_idx
  on public.ice_alert_subscribers (email_opt_in, confirmed_at);

create table if not exists public.ice_alert_surge_events (
  surge_key text primary key,
  scope text not null check (scope in ('city', 'state', 'national')),
  label text not null,
  state_code text,
  city text,
  active_count integer not null check (active_count > 0),
  window_minutes integer not null check (window_minutes > 0),
  detected_at timestamptz not null default now(),
  notified_at timestamptz,
  delivery_count integer not null default 0 check (delivery_count >= 0)
);

create index if not exists ice_alert_surge_events_pending_idx
  on public.ice_alert_surge_events (notified_at, detected_at);

alter table public.ice_alert_subscribers enable row level security;
alter table public.ice_alert_surge_events enable row level security;

revoke all on table public.ice_alert_subscribers from anon, authenticated;
revoke all on table public.ice_alert_surge_events from anon, authenticated;
grant all on table public.ice_alert_subscribers to service_role;
grant all on table public.ice_alert_surge_events to service_role;

comment on table public.ice_alert_subscribers is
  'Private surge-alert subscribers. Service-role only; no public RLS policies.';
comment on column public.ice_alert_subscribers.push_subscription is
  'Browser Web Push endpoint and keys. Never exposed to the client.';
comment on table public.ice_alert_surge_events is
  'Idempotency ledger for surge notifications; one row per 15-minute surge key.';
