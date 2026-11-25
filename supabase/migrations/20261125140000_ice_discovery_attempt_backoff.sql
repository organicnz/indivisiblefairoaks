-- Transient discovery failures used to remain at the head of the oldest-first
-- queue, so two timing-out publishers could starve every newer candidate. Record
-- the last attempt and sort unattempted rows first; a failed row rotates to the
-- back but stays pending for a later scheduled retry.
alter table public.ice_crawl_discoveries
  add column if not exists last_attempt_at timestamptz;

drop index if exists public.ice_crawl_discoveries_pending_idx;
create index if not exists ice_crawl_discoveries_pending_attempt_idx
  on public.ice_crawl_discoveries (status, last_attempt_at asc nulls first, discovered_at asc);
