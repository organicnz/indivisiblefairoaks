-- Append-only admin audit log.
--
-- Recorded by the server after the admin gate has verified the profile grant,
-- a TOTP factor and an AAL2 session. Rows capture who acted, what they changed,
-- the values before and after, the MFA level of the session and the outcome.
--
-- RLS is enabled with no client policies. The table is read and written only
-- through the service-role client; a signed-in browser must never be able to
-- enumerate other administrators' actions. UPDATE and DELETE are rejected by a
-- trigger as well as by the lack of grants, so an audit row cannot be rewritten
-- by an application bug or a future broad service-role grant.

create table if not exists public.admin_audit_log (
    id              uuid primary key default gen_random_uuid(),
    created_at      timestamptz not null default now(),
    actor_user_id   uuid not null,
    actor_email     text,
    action          text not null check (btrim(action) <> ''),
    target_type     text not null check (btrim(target_type) <> ''),
    target_id       text not null check (btrim(target_id) <> ''),
    target_label    text,
    before          jsonb,
    after           jsonb,
    mfa_level       text not null default 'unknown'
                        check (mfa_level in ('aal1', 'aal2', 'unknown')),
    outcome         text not null
                        check (outcome in ('success', 'failure', 'denied')),
    error           text,
    metadata        jsonb
);

create index if not exists admin_audit_log_created_at_idx
    on public.admin_audit_log (created_at desc);

create index if not exists admin_audit_log_actor_idx
    on public.admin_audit_log (actor_user_id, created_at desc);

create index if not exists admin_audit_log_action_idx
    on public.admin_audit_log (action, created_at desc);

create index if not exists admin_audit_log_target_idx
    on public.admin_audit_log (target_type, target_id, created_at desc);

alter table public.admin_audit_log enable row level security;

revoke all on table public.admin_audit_log from anon, authenticated;
revoke all on table public.admin_audit_log from service_role;
grant select, insert on table public.admin_audit_log to service_role;

-- Belt and braces for the append-only promise. Grants already withhold UPDATE,
-- DELETE and TRUNCATE from every application role, but a future migration that
-- grants more broadly must not silently make history mutable.
create or replace function public.reject_admin_audit_log_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    raise exception 'admin_audit_log is append-only; % is not permitted', tg_op
        using errcode = '42501';
end;
$$;

revoke all on function public.reject_admin_audit_log_mutation()
    from public, anon, authenticated;
-- The trigger fires for service-role writes, so that role must be able to
-- execute the function. It only raises, so executing it directly is harmless.
grant execute on function public.reject_admin_audit_log_mutation()
    to service_role;

drop trigger if exists admin_audit_log_append_only on public.admin_audit_log;
create trigger admin_audit_log_append_only
    before update or delete on public.admin_audit_log
    for each row execute function public.reject_admin_audit_log_mutation();

-- TRUNCATE is not governed by RLS and is a statement-level operation, so the
-- row trigger above cannot see it. Refuse it explicitly as well.
drop trigger if exists admin_audit_log_no_truncate on public.admin_audit_log;
create trigger admin_audit_log_no_truncate
    before truncate on public.admin_audit_log
    for each statement execute function public.reject_admin_audit_log_mutation();

comment on table public.admin_audit_log is
    'Append-only records of privileged admin mutations: actor, target, before/after values, MFA level and outcome.';
