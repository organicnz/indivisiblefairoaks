-- Private ICE report intake and sanitized public projection.
--
-- Raw intake is service-role only. A report cannot be published by the same
-- person who prepared its public draft: the database function below checks the
-- two reviewer IDs and inserts only the allowlisted city-level fields.

create table if not exists public.ice_report_intake (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null check (reference_code ~ '^C-[A-Z0-9]{7}$'),
  city text not null check (length(city) between 2 and 80),
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  kind text not null check (kind in ('enforcement', 'detention', 'checkpoint')),
  observed_at timestamptz not null,
  summary text not null check (length(summary) between 30 and 600),
  status text not null default 'received' check (
    status in ('received', 'needs_second_review', 'published', 'rejected')
  ),
  reviewer_one_id uuid,
  reviewer_one_at timestamptz,
  reviewer_two_id uuid,
  reviewer_two_at timestamptz,
  public_city text check (public_city is null or length(public_city) between 2 and 80),
  public_state_code text check (
    public_state_code is null or public_state_code ~ '^[A-Z]{2}$'
  ),
  public_kind text check (
    public_kind is null or public_kind in ('enforcement', 'detention', 'checkpoint')
  ),
  public_observed_at timestamptz,
  public_summary text check (
    public_summary is null or length(public_summary) between 30 and 400
  ),
  rejection_reason text check (
    rejection_reason is null or length(rejection_reason) <= 300
  ),
  retention_expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ice_report_intake_reference_unique unique (reference_code),
  constraint ice_report_intake_two_person_publish check (
    status <> 'published'
    or (
      reviewer_one_id is not null
      and reviewer_two_id is not null
      and reviewer_one_id <> reviewer_two_id
      and public_city is not null
      and public_state_code is not null
      and public_kind is not null
      and public_observed_at is not null
      and public_summary is not null
    )
  )
);

create index if not exists ice_report_intake_status_idx
  on public.ice_report_intake (status, created_at desc);
create index if not exists ice_report_intake_retention_idx
  on public.ice_report_intake (retention_expires_at);

create or replace function public.ice_report_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.ice_report_touch_updated_at() from public, anon, authenticated;
grant execute on function public.ice_report_touch_updated_at() to service_role;

drop trigger if exists ice_report_intake_set_updated_at
  on public.ice_report_intake;
create trigger ice_report_intake_set_updated_at
  before update on public.ice_report_intake
  for each row execute function public.ice_report_touch_updated_at();

-- The public projection contains no raw text, reporter data, street address,
-- plate, name, or identity. The id is independent from the private row so the
-- private identifier is not exposed.
create table if not exists public.ice_public_reports (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique,
  city text not null check (length(city) between 2 and 80),
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  kind text not null check (kind in ('enforcement', 'detention', 'checkpoint')),
  observed_at timestamptz not null,
  summary text not null check (length(summary) between 30 and 400),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  published_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index if not exists ice_public_reports_active_idx
  on public.ice_public_reports (expires_at, observed_at desc);

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

alter table public.ice_report_intake enable row level security;
revoke all on table public.ice_report_intake from anon, authenticated;
grant all on table public.ice_report_intake to service_role;

alter table public.ice_public_reports enable row level security;
revoke insert, update, delete on table public.ice_public_reports from anon, authenticated;
-- Do not expose report_id, which is the private row's identifier. The public
-- section reads through the service role and still never displays it.
revoke select on table public.ice_public_reports from anon, authenticated;
grant select (id, city, state_code, kind, observed_at, summary, lat, lng, published_at, expires_at)
  on table public.ice_public_reports to anon, authenticated;
grant all on table public.ice_public_reports to service_role;

drop policy if exists ice_public_reports_read on public.ice_public_reports;
create policy ice_public_reports_read
  on public.ice_public_reports
  for select
  to anon, authenticated
  using (published_at <= now() and expires_at > now());

comment on table public.ice_report_intake is
  'Private ICE report intake. Service-role only; no public RLS policies.';
comment on column public.ice_report_intake.summary is
  'Private reporter text, never exposed. Reviewers prepare a separate public_summary.';
comment on column public.ice_report_intake.reviewer_one_id is
  'First reviewer who prepared the sanitized city-level draft.';
comment on column public.ice_report_intake.reviewer_two_id is
  'Second, different reviewer who approved publication.';
comment on table public.ice_public_reports is
  'Allowlisted public ICE reports. No raw text, reporter data, or street address.';
