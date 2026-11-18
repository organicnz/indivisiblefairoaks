-- Last-known-good snapshot for the public ICE rapid-response feed.
--
-- Upstream sources are outside this project's control: the community export is
-- a large nightly XML file and the ICE newsroom RSS feed can be slow or
-- unavailable. Persisting the normalized feed lets a cold serverless instance
-- serve a complete, already-sanitized snapshot while it revalidates, instead of
-- returning an empty map or waiting on every upstream source.
--
-- The payload contains only the public projection assembled by
-- src/lib/ice-rapid-feed.ts: city-level locations, sanitized summaries, and
-- public source links. Raw reports never enter this table.

create table if not exists public.ice_rapid_feed_cache (
  id text primary key check (id = 'current'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  generated_at timestamptz not null,
  fetched_at timestamptz not null default now()
);

alter table public.ice_rapid_feed_cache enable row level security;
revoke all on table public.ice_rapid_feed_cache from anon, authenticated;
grant all on table public.ice_rapid_feed_cache to service_role;

comment on table public.ice_rapid_feed_cache is
  'Server-only last-known-good snapshot for /api/ice-rapid. Never exposed to public roles.';
