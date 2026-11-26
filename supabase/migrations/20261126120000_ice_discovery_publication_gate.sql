-- Discovery intake is automatic, but publication is not.
--
-- `rights_status` answers "may the chapter republish this source's full text?"
-- and remains the mandatory human gate. `publication_status` answers a separate
-- question: "has this row been submitted for public release?" Both must be true
-- for a row to appear in any public surface. Keeping the two concepts apart is
-- what lets a scheduler admit and AI-screen candidates without silently
-- publishing them.
--
-- Existing rows came from the approved-source crawler and were already public,
-- so the default is `published`. New discovery intake rows explicitly write
-- `draft` unless the operator turns on ICE_DISCOVERY_AUTO_PUBLISH.

alter table public.ice_source_reports
  add column if not exists publication_status text not null default 'published';

-- The existing discovery backlog was admitted before the switch existed. It is
-- still rights-unconfirmed and therefore not public, but mark it as draft too so
-- confirming rights cannot release it accidentally while auto-publish is off.
update public.ice_source_reports
   set publication_status = 'draft'
 where provenance = 'discovery'
   and rights_status = 'unconfirmed';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'ice_source_reports_publication_status_check'
       and conrelid = 'public.ice_source_reports'::regclass
  ) then
    alter table public.ice_source_reports
      add constraint ice_source_reports_publication_status_check
      check (publication_status in ('draft', 'published'));
  end if;
end
$$;

-- Public reads go through the same three-part gate whether they use RLS or the
-- service-role client: submitted, rights-confirmed, and not future-dated.
drop policy if exists ice_source_reports_read on public.ice_source_reports;
create policy ice_source_reports_read
  on public.ice_source_reports
  for select
  to anon, authenticated
  using (
    publication_status = 'published'
    and rights_status = 'confirmed'
    and published_at <= now()
  );

-- The admin publication preview counts and lists drafts by this pair, and the
-- public archive orders by published_at. A composite index keeps both bounded.
create index if not exists ice_source_reports_publication_gate_idx
  on public.ice_source_reports (publication_status, rights_status, published_at desc);

comment on column public.ice_source_reports.publication_status is
  'published = submitted for public release; draft = retained for admin review. Public visibility also requires rights_status = confirmed and published_at <= now().';
