-- Nationwide discovery queue for the source-attributed ICE report crawler.
--
-- Discovery only records a public headline, publisher, publication time and
-- URL. It does not fetch or republish article text. An admin must approve a
-- candidate (confirming republication rights) before the normal crawler fetches
-- the page and runs AI/deterministic extraction.

create table if not exists public.ice_crawl_discoveries (
  id uuid primary key default gen_random_uuid(),
  url text not null check (url ~ '^https://'),
  title text not null check (length(title) between 1 and 300),
  publisher text check (publisher is null or length(publisher) <= 120),
  published_at timestamptz,
  discovery_query text not null check (length(discovery_query) <= 120),
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected')
  ),
  source_id uuid references public.ice_crawl_sources(id) on delete set null,
  discovered_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_note text check (review_note is null or length(review_note) <= 500),
  constraint ice_crawl_discoveries_url_unique unique (url)
);

create index if not exists ice_crawl_discoveries_pending_idx
  on public.ice_crawl_discoveries (status, discovered_at desc);

alter table public.ice_crawl_discoveries enable row level security;
revoke all on table public.ice_crawl_discoveries from anon, authenticated;
grant all on table public.ice_crawl_discoveries to service_role;

-- Seed the federal newsrooms that publish nationwide ICE enforcement and
-- removal releases. These are U.S. government works and remain attributable
-- to the exact release URL. The source crawl still follows each site's
-- robots.txt and page limits.
insert into public.ice_crawl_sources (url, label, max_pages, rights_confirmed_at)
values
  ('https://www.ice.gov/newsroom', 'ICE newsroom (national)', 50, now()),
  ('https://www.dhs.gov/news-releases', 'DHS newsroom (national)', 50, now()),
  ('https://www.justice.gov/news/press-releases', 'DOJ national press releases', 50, now()),
  ('https://www.cbp.gov/newsroom', 'CBP newsroom (national)', 50, now())
on conflict (url) do nothing;

comment on table public.ice_crawl_discoveries is
  'Nationwide news candidates awaiting an admin republication-rights decision. Never exposed to public roles.';
comment on column public.ice_crawl_discoveries.status is
  'pending until an admin approves or rejects the candidate.';
comment on column public.ice_crawl_discoveries.source_id is
  'The approved source created when a candidate is approved and crawled.';
