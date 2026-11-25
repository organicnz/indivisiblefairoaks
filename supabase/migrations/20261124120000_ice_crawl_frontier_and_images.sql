-- A scheduled crawl tick has a function-time budget, so a source with more
-- pages than one tick can fetch must resume instead of restarting from its
-- seed and re-walking the same pages forever. The frontier is the crawl queue
-- that outlives a tick: URLs are inserted as they are discovered, deleted as
-- they are fetched, and emptied when the source has been walked to its page
-- limit. Service-role only; this is crawler state, not content.
create table if not exists public.ice_crawl_frontier (
  source_id uuid not null references public.ice_crawl_sources(id) on delete cascade,
  url text not null check (url ~ '^https://'),
  depth integer not null default 0 check (depth between 0 and 8),
  queued_at timestamptz not null default now(),
  primary key (source_id, url)
);

create index if not exists ice_crawl_frontier_queue_idx
  on public.ice_crawl_frontier (source_id, queued_at);

alter table public.ice_crawl_frontier enable row level security;
revoke all on table public.ice_crawl_frontier from anon, authenticated;
grant all on table public.ice_crawl_frontier to service_role;

comment on table public.ice_crawl_frontier is
  'Crawler queue persisted between bounded ticks. Service-role only.';

-- Evidence images attached to a crawled page. The bytes live in the private
-- ice-evidence bucket; this table is the index and provenance, never a public
-- URL. `dedupe_key` is derived from the remote URL and its byte length so a
-- re-crawl of the same page does not duplicate an object.
create table if not exists public.ice_crawl_page_images (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.ice_crawl_sources(id) on delete cascade,
  page_id uuid not null references public.ice_crawl_pages(id) on delete cascade,
  image_url text not null check (image_url ~ '^https://'),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/webp')),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  bytes integer check (bytes is null or bytes > 0),
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists ice_crawl_page_images_page_idx
  on public.ice_crawl_page_images (page_id);

alter table public.ice_crawl_page_images enable row level security;
revoke all on table public.ice_crawl_page_images from anon, authenticated;
grant all on table public.ice_crawl_page_images to service_role;

comment on table public.ice_crawl_page_images is
  'Compressed evidence images for crawled ICE pages. Bytes are in the private ice-evidence bucket; service-role only.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ice-evidence',
  'ice-evidence',
  false,
  6291456,
  array['image/webp', 'image/jpeg']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
