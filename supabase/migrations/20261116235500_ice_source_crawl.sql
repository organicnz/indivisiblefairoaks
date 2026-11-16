-- Source-preserving public web report crawler.
--
-- The source registry and fetched pages are admin/service-role only. The
-- published report table contains the readable source text, its exact source
-- URL, and retrieval metadata; it never contains raw HTML or crawler secrets.

create table if not exists public.ice_crawl_sources (
  id uuid primary key default gen_random_uuid(),
  url text not null check (url ~ '^https://'),
  label text not null check (length(label) between 1 and 120),
  enabled boolean not null default true,
  max_pages integer not null default 20 check (max_pages between 1 and 200),
  rights_confirmed_at timestamptz not null,
  last_crawled_at timestamptz,
  last_status text check (
    last_status is null or last_status in ('ok', 'partial', 'error', 'blocked')
  ),
  last_error text check (last_error is null or length(last_error) <= 500),
  last_page_count integer not null default 0 check (last_page_count >= 0),
  last_report_count integer not null default 0 check (last_report_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ice_crawl_sources_url_unique unique (url)
);

create index if not exists ice_crawl_sources_enabled_idx
  on public.ice_crawl_sources (enabled, created_at);

create or replace function public.ice_crawl_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.ice_crawl_touch_updated_at() from public, anon, authenticated;
grant execute on function public.ice_crawl_touch_updated_at() to service_role;

drop trigger if exists ice_crawl_sources_set_updated_at on public.ice_crawl_sources;
create trigger ice_crawl_sources_set_updated_at
  before update on public.ice_crawl_sources
  for each row execute function public.ice_crawl_touch_updated_at();

-- One row per fetched URL. The readable text is retained here for audit and
-- deduplication. This table is never exposed to anon/authenticated.
create table if not exists public.ice_crawl_pages (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.ice_crawl_sources(id) on delete cascade,
  url text not null,
  final_url text,
  http_status integer,
  content_type text,
  content_hash text,
  title text,
  text_content text,
  error text check (error is null or length(error) <= 500),
  extraction_method text check (
    extraction_method is null or extraction_method in ('feed', 'html', 'ai', 'fallback')
  ),
  report_count integer not null default 0 check (report_count >= 0),
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint ice_crawl_pages_source_url_unique unique (source_id, url)
);

create index if not exists ice_crawl_pages_source_fetched_idx
  on public.ice_crawl_pages (source_id, fetched_at desc);

-- Public projection. `text_content` is the readable source text, not an
-- AI-generated summary; `source_url` is the exact page it came from.
create table if not exists public.ice_source_reports (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.ice_crawl_sources(id) on delete cascade,
  page_id uuid references public.ice_crawl_pages(id) on delete set null,
  source_name text not null check (length(source_name) between 1 and 120),
  source_url text not null check (source_url ~ '^https://'),
  source_title text,
  source_published_at timestamptz,
  source_retrieved_at timestamptz not null,
  title text not null check (length(title) between 1 and 240),
  text_content text not null check (length(text_content) between 20 and 500000),
  city text,
  state_code text check (state_code is null or state_code ~ '^[A-Z]{2}$'),
  kind text not null check (kind in ('enforcement', 'detention', 'checkpoint', 'other')),
  extraction_method text not null check (extraction_method in ('feed', 'html', 'ai', 'fallback')),
  dedupe_key text not null unique,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists ice_source_reports_published_idx
  on public.ice_source_reports (published_at desc);
create index if not exists ice_source_reports_source_idx
  on public.ice_source_reports (source_id, published_at desc);

alter table public.ice_crawl_sources enable row level security;
revoke all on table public.ice_crawl_sources from anon, authenticated;
grant all on table public.ice_crawl_sources to service_role;

alter table public.ice_crawl_pages enable row level security;
revoke all on table public.ice_crawl_pages from anon, authenticated;
grant all on table public.ice_crawl_pages to service_role;

alter table public.ice_source_reports enable row level security;
revoke insert, update, delete on table public.ice_source_reports from anon, authenticated;
revoke select on table public.ice_source_reports from anon, authenticated;
grant select (id, source_name, source_url, source_title, source_published_at, source_retrieved_at, title, text_content, city, state_code, kind, extraction_method, published_at)
  on table public.ice_source_reports to anon, authenticated;
grant all on table public.ice_source_reports to service_role;

drop policy if exists ice_source_reports_read on public.ice_source_reports;
create policy ice_source_reports_read
  on public.ice_source_reports
  for select
  to anon, authenticated
  using (published_at <= now());

-- The chapter already republishes the public StopICE alert export. Seed that
-- existing source so the source-preserving crawler has a working, attributable
-- baseline; admins can disable it if the source relationship changes.
insert into public.ice_crawl_sources (url, label, max_pages, rights_confirmed_at)
values ('https://stopice.net/?data=1', 'Stop ICE Alerts Network', 5, now())
on conflict (url) do nothing;

comment on table public.ice_crawl_sources is
  'Admin-managed public source allowlist for the ICE report crawler.';
comment on table public.ice_crawl_pages is
  'Private fetched-page audit trail. Never exposed to public roles.';
comment on table public.ice_source_reports is
  'Public full-text source reports with exact source URL and retrieval time.';
comment on column public.ice_crawl_sources.rights_confirmed_at is
  'Admin attestation that the chapter may republish text from this source.';
