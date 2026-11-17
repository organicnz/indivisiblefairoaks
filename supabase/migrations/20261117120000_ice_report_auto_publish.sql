-- Narrow automatic-publication path for private ICE reports.
--
-- A unique, low-risk report may publish only a generated city-level summary.
-- Similar reports for the same city/state/category within the review window are
-- merged into one public entry and increment a corroboration count. Raw report
-- text never leaves the private intake table.

alter table public.ice_public_reports
  add column if not exists corroboration_count integer not null default 1;

alter table public.ice_public_reports
  drop constraint if exists ice_public_reports_corroboration_count_check;
alter table public.ice_public_reports
  add constraint ice_public_reports_corroboration_count_check
  check (corroboration_count between 1 and 1000);

alter table public.ice_report_intake
  add column if not exists auto_published boolean not null default false;

alter table public.ice_report_intake
  add column if not exists public_report_id uuid
  references public.ice_public_reports(id) on delete set null;

-- Backfill the link for reports published under the original manual path.
update public.ice_report_intake i
   set public_report_id = p.id
  from public.ice_public_reports p
 where p.report_id = i.id
   and i.public_report_id is null;

alter table public.ice_report_intake
  drop constraint if exists ice_report_intake_status_check;
alter table public.ice_report_intake
  add constraint ice_report_intake_status_check
  check (status in ('received', 'needs_second_review', 'published', 'merged', 'rejected'));

alter table public.ice_report_intake
  drop constraint if exists ice_report_intake_two_person_publish;
alter table public.ice_report_intake
  add constraint ice_report_intake_publication_path check (
    status <> 'published'
    or (
      public_city is not null
      and public_state_code is not null
      and public_kind is not null
      and public_observed_at is not null
      and public_summary is not null
      and (
        (
          auto_published = true
          and reviewer_one_id is null
          and reviewer_two_id is null
        )
        or (
          auto_published = false
          and reviewer_one_id is not null
          and reviewer_two_id is not null
          and reviewer_one_id <> reviewer_two_id
        )
      )
    )
  );

alter table public.ice_report_intake
  drop constraint if exists ice_report_intake_merged_path;
alter table public.ice_report_intake
  add constraint ice_report_intake_merged_path check (
    status <> 'merged'
    or (
      auto_published = true
      and public_city is not null
      and public_state_code is not null
      and public_kind is not null
      and public_observed_at is not null
      and public_summary is not null
    )
  );
-- public_report_id is deliberately not required here. Expired public rows are
-- purged after seven days while the private audit row remains for 30 days; the
-- foreign key then nulls the link without invalidating the merged audit status.

create index if not exists ice_report_intake_event_lookup_idx
  on public.ice_report_intake (city, state_code, kind, observed_at desc);

grant select (corroboration_count)
  on table public.ice_public_reports to anon, authenticated;

-- Keep the manual two-person path, and record the public row it created.
create or replace function public.ice_publish_report(
  p_report_id uuid,
  p_reviewer_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.ice_report_intake%rowtype;
  v_public_id uuid;
begin
  if p_reviewer_id is null then
    raise exception 'reviewer is required';
  end if;
  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'valid city coordinates are required';
  end if;

  select *
    into v_report
    from public.ice_report_intake
   where id = p_report_id
   for update;

  if not found then
    raise exception 'report not found';
  end if;
  if v_report.status <> 'needs_second_review' then
    raise exception 'report is not ready for publication';
  end if;
  if v_report.reviewer_one_id is null or v_report.reviewer_one_id = p_reviewer_id then
    raise exception 'a different reviewer must approve publication';
  end if;
  if v_report.public_city is null
     or v_report.public_state_code is null
     or v_report.public_kind is null
     or v_report.public_observed_at is null
     or v_report.public_summary is null then
    raise exception 'sanitized public draft is incomplete';
  end if;

  insert into public.ice_public_reports (
    report_id,
    city,
    state_code,
    kind,
    observed_at,
    summary,
    lat,
    lng
  ) values (
    v_report.id,
    v_report.public_city,
    v_report.public_state_code,
    v_report.public_kind,
    v_report.public_observed_at,
    v_report.public_summary,
    p_lat,
    p_lng
  )
  returning id into v_public_id;

  update public.ice_report_intake
     set status = 'published',
         auto_published = false,
         public_report_id = v_public_id,
         reviewer_two_id = p_reviewer_id,
         reviewer_two_at = now()
   where id = p_report_id;

  return v_public_id;
end;
$$;

revoke all on function public.ice_publish_report(uuid, uuid, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.ice_publish_report(uuid, uuid, double precision, double precision)
  to service_role;

-- Atomically publish a generated city-level summary or merge the private report
-- into an existing active public entry. p_merge_public_id is null for a unique
-- event and non-null for a verified near-duplicate.
create or replace function public.ice_auto_publish_report(
  p_report_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_public_summary text,
  p_merge_public_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.ice_report_intake%rowtype;
  v_public public.ice_public_reports%rowtype;
  v_public_id uuid;
begin
  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'valid city coordinates are required';
  end if;
  if p_public_summary is null
     or length(p_public_summary) < 30
     or length(p_public_summary) > 400 then
    raise exception 'a generated city-level summary is required';
  end if;

  select *
    into v_report
    from public.ice_report_intake
   where id = p_report_id
   for update;

  if not found then
    raise exception 'report not found';
  end if;
  if v_report.status <> 'received' then
    raise exception 'report is not ready for automatic publication';
  end if;
  if v_report.auto_published then
    raise exception 'report already used the automatic path';
  end if;

  if p_merge_public_id is not null then
    select *
      into v_public
      from public.ice_public_reports
     where id = p_merge_public_id
     for update;

    if not found then
      raise exception 'matching public report not found';
    end if;
    if v_public.expires_at <= now() then
      raise exception 'matching public report has expired';
    end if;
    if lower(v_public.city) <> lower(v_report.city)
       or v_public.state_code <> v_report.state_code
       or v_public.kind <> v_report.kind then
      raise exception 'matching public report is for a different event';
    end if;

    update public.ice_public_reports
       set corroboration_count = corroboration_count + 1,
           expires_at = greatest(expires_at, now() + interval '7 days')
     where id = p_merge_public_id;

    update public.ice_report_intake
       set status = 'merged',
           auto_published = true,
           public_report_id = p_merge_public_id,
           public_city = v_report.city,
           public_state_code = v_report.state_code,
           public_kind = v_report.kind,
           public_observed_at = v_report.observed_at,
           public_summary = p_public_summary
     where id = p_report_id;

    return p_merge_public_id;
  end if;

  insert into public.ice_public_reports (
    report_id,
    city,
    state_code,
    kind,
    observed_at,
    summary,
    lat,
    lng,
    corroboration_count
  ) values (
    v_report.id,
    v_report.city,
    v_report.state_code,
    v_report.kind,
    v_report.observed_at,
    p_public_summary,
    p_lat,
    p_lng,
    1
  )
  returning id into v_public_id;

  update public.ice_report_intake
     set status = 'published',
         auto_published = true,
         public_report_id = v_public_id,
         public_city = v_report.city,
         public_state_code = v_report.state_code,
         public_kind = v_report.kind,
         public_observed_at = v_report.observed_at,
         public_summary = p_public_summary
   where id = p_report_id;

  return v_public_id;
end;
$$;

revoke all on function public.ice_auto_publish_report(uuid, double precision, double precision, text, uuid)
  from public, anon, authenticated;
grant execute on function public.ice_auto_publish_report(uuid, double precision, double precision, text, uuid)
  to service_role;

comment on column public.ice_report_intake.auto_published is
  'True when the generated city-level path published or merged this report.';
comment on column public.ice_report_intake.public_report_id is
  'The public row created by manual review or the automatic merge path.';
comment on column public.ice_public_reports.corroboration_count is
  'Number of near-duplicate private reports combined into this public entry.';
