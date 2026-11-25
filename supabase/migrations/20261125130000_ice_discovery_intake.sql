-- Auto-discovery intake.
--
-- Internet-wide discovery already stores candidate headlines in
-- `ice_crawl_discoveries`. Those candidates were review-only: nothing turned
-- them into reports. This migration makes the provenance of an automatically
-- admitted case explicit instead of pretending it is the same as a crawled,
-- rights-confirmed source:
--
--   * `provenance = 'crawl'`  — fetched from an approved source and extracted.
--   * `provenance = 'discovery'` — an attributed summary admitted by the
--     discovery screen, with `rights_status = 'unconfirmed'`.
--
-- `rights_status` is deliberately a column rather than a convention. Existing
-- rows default to `confirmed` because every pre-existing report came through
-- the approved-source path; only the discovery intake writes `unconfirmed`.
-- An admin can promote a discovery row to full text, which flips it back to
-- `crawl`/`confirmed` after the canonical page is fetched.

alter table public.ice_source_reports
  add column if not exists provenance text not null default 'crawl',
  add column if not exists rights_status text not null default 'confirmed',
  add column if not exists summary text,
  add column if not exists discovery_id uuid references public.ice_crawl_discoveries(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'ice_source_reports_provenance_check'
       and conrelid = 'public.ice_source_reports'::regclass
  ) then
    alter table public.ice_source_reports
      add constraint ice_source_reports_provenance_check
      check (provenance in ('crawl', 'discovery'));
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'ice_source_reports_rights_status_check'
       and conrelid = 'public.ice_source_reports'::regclass
  ) then
    alter table public.ice_source_reports
      add constraint ice_source_reports_rights_status_check
      check (rights_status in ('confirmed', 'unconfirmed'));
  end if;
end
$$;

create index if not exists ice_source_reports_provenance_idx
  on public.ice_source_reports (provenance, rights_status, published_at desc);

create index if not exists ice_source_reports_discovery_idx
  on public.ice_source_reports (discovery_id)
  where discovery_id is not null;

-- One stable source row owns every auto-discovered report. It is disabled so
-- the normal source rotation never crawls a seed for it; the intake path
-- writes pages and reports directly with the canonical article URL.
insert into public.ice_crawl_sources (url, label, enabled, max_pages, rights_confirmed_at)
values (
  'https://www.ice.gov/',
  'Nationwide web discovery',
  false,
  1,
  now()
)
on conflict (url) do nothing;

comment on column public.ice_source_reports.provenance is
  'crawl = approved-source crawl; discovery = automatically admitted internet discovery summary.';
comment on column public.ice_source_reports.rights_status is
  'confirmed = rights cleared for full text; unconfirmed = attributed summary only.';
comment on column public.ice_source_reports.summary is
  'Short attributed abstract for an unconfirmed discovery report; null for crawled full text.';
