-- Private family-reunification intake for /ice-alerts/reunification.
--
-- Nothing in this table is ever mapped, published, or exposed through anon
-- policies. The public page only creates a request; a caseworker reviews it and
-- shares a verified status through the tokenized status page. Photos are stored
-- in a private bucket and are never given a public URL.

create table if not exists public.ice_reunification_requests (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null check (reference_code ~ '^R-[A-Z0-9]{7}$'),
  access_token uuid not null default gen_random_uuid(),
  submitter_name text not null check (length(submitter_name) between 2 and 120),
  submitter_email text not null check (
    length(submitter_email) between 3 and 320 and position('@' in submitter_email) > 1
  ),
  submitter_phone text check (submitter_phone is null or length(submitter_phone) <= 40),
  relationship text not null check (length(relationship) between 2 and 80),
  person_name text not null check (length(person_name) between 2 and 120),
  person_aliases text check (person_aliases is null or length(person_aliases) <= 200),
  person_dob date,
  detention_date date,
  detention_city text check (detention_city is null or length(detention_city) <= 80),
  detention_state text check (detention_state is null or detention_state ~ '^[A-Z]{2}$'),
  facility text check (facility is null or length(facility) <= 160),
  a_number text check (a_number is null or length(a_number) <= 24),
  notes text check (notes is null or length(notes) <= 4000),
  photo_path text,
  status text not null default 'received' check (
    status in ('received', 'verifying', 'verified', 'closed')
  ),
  status_note text check (status_note is null or length(status_note) <= 2000),
  consent_contact boolean not null,
  consent_privacy boolean not null,
  retention_expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ice_reunification_reference_unique unique (reference_code),
  constraint ice_reunification_access_token_unique unique (access_token),
  constraint ice_reunification_consent_required check (consent_contact and consent_privacy)
);

create index if not exists ice_reunification_status_idx
  on public.ice_reunification_requests (status, created_at desc);
create index if not exists ice_reunification_retention_idx
  on public.ice_reunification_requests (retention_expires_at);

create or replace function public.ice_reunification_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.ice_reunification_touch_updated_at() from public, anon, authenticated;
grant execute on function public.ice_reunification_touch_updated_at() to service_role;

drop trigger if exists ice_reunification_set_updated_at
  on public.ice_reunification_requests;
create trigger ice_reunification_set_updated_at
  before update on public.ice_reunification_requests
  for each row execute function public.ice_reunification_touch_updated_at();

alter table public.ice_reunification_requests enable row level security;
revoke all on table public.ice_reunification_requests from anon, authenticated;
grant all on table public.ice_reunification_requests to service_role;

comment on table public.ice_reunification_requests is
  'Private family reunification intake. Service-role only; no public RLS policies.';
comment on column public.ice_reunification_requests.person_name is
  'Private subject name for verification. Never exposed by the public status page.';
comment on column public.ice_reunification_requests.photo_path is
  'Object path in the private ice-reunification bucket. Never a public URL.';
comment on column public.ice_reunification_requests.retention_expires_at is
  'Default 90-day review/retention deadline. Purge expired rows and private photos from the dashboard or a scheduled job.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ice-reunification',
  'ice-reunification',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
