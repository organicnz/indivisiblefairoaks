-- Durable delivery for admin audit records.
--
-- The mutation commits before the audit write is attempted, so a transient
-- failure in the append-only log must not be the end of the record. A failed
-- write is copied here with the complete payload; the same id is reused, which
-- makes delivery idempotent even when the original insert committed but its
-- response was lost. A pg_cron job drains the outbox into admin_audit_log.
--
-- The outbox is service-role only, like the audit log. It is intentionally
-- mutable: delivered rows are deleted, and failed deliveries record their next
-- attempt and last error. Losing the outbox row before delivery would lose the
-- only copy of the audit event, so no client role has access.

create table if not exists public.admin_audit_outbox (
    id              uuid primary key,
    payload         jsonb not null,
    created_at      timestamptz not null default now(),
    attempts        integer not null default 0 check (attempts >= 0),
    next_attempt_at timestamptz not null default now(),
    last_error      text,
    constraint admin_audit_outbox_payload_object
        check (jsonb_typeof(payload) = 'object'),
    -- The row id and the payload id are the audit row's idempotency key. If a
    -- future caller tries to queue a different payload under the same id, reject
    -- it at the boundary rather than deliver an ambiguous record.
    constraint admin_audit_outbox_payload_id
        check (payload ? 'id' and (payload ->> 'id')::uuid = id)
);

create index if not exists admin_audit_outbox_next_attempt_idx
    on public.admin_audit_outbox (next_attempt_at, created_at);

alter table public.admin_audit_outbox enable row level security;

revoke all on table public.admin_audit_outbox from anon, authenticated;
revoke all on table public.admin_audit_outbox from service_role;
grant select, insert, update, delete on table public.admin_audit_outbox to service_role;

-- Move due outbox rows into the append-only log. The insert is idempotent on
-- the audit id, so a row whose original insert actually committed is simply
-- removed rather than duplicated. A failed delivery stays queued with a bounded
-- exponential backoff; it is never discarded.
create or replace function public.deliver_admin_audit_outbox(batch_size integer default 100)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    item record;
    delivered integer := 0;
    retry_seconds integer;
begin
    if batch_size is null or batch_size < 1 then
        batch_size := 100;
    elsif batch_size > 1000 then
        batch_size := 1000;
    end if;

    for item in
        select id, payload, created_at, attempts
        from public.admin_audit_outbox
        where next_attempt_at <= now()
        order by created_at
        limit batch_size
        for update skip locked
    loop
        begin
            insert into public.admin_audit_log (
                id,
                created_at,
                actor_user_id,
                actor_email,
                action,
                target_type,
                target_id,
                target_label,
                before,
                after,
                mfa_level,
                outcome,
                error,
                metadata
            )
            values (
                item.id,
                item.created_at,
                (item.payload ->> 'actor_user_id')::uuid,
                item.payload ->> 'actor_email',
                item.payload ->> 'action',
                item.payload ->> 'target_type',
                item.payload ->> 'target_id',
                item.payload ->> 'target_label',
                nullif(item.payload -> 'before', 'null'::jsonb),
                nullif(item.payload -> 'after', 'null'::jsonb),
                coalesce(item.payload ->> 'mfa_level', 'unknown'),
                item.payload ->> 'outcome',
                item.payload ->> 'error',
                nullif(item.payload -> 'metadata', 'null'::jsonb)
            )
            on conflict (id) do nothing;

            delete from public.admin_audit_outbox where id = item.id;
            delivered := delivered + 1;
        exception when others then
            -- 30s, 60s, 120s, … capped at one hour. Keep the row visible so an
            -- operator can inspect last_error and so the next pass retries it.
            retry_seconds := least(
                3600,
                30 * power(2, least(item.attempts, 6))::integer
            );
            update public.admin_audit_outbox
            set attempts = attempts + 1,
                last_error = left(sqlerrm, 2000),
                next_attempt_at = now() + make_interval(secs => retry_seconds)
            where id = item.id;
        end;
    end loop;

    return delivered;
end;
$$;

revoke all on function public.deliver_admin_audit_outbox(integer)
    from public, anon, authenticated;
grant execute on function public.deliver_admin_audit_outbox(integer)
    to service_role;

comment on table public.admin_audit_outbox is
    'Durable retry queue for admin audit writes that could not reach admin_audit_log. Service-role only; delivered rows are deleted.';

comment on function public.deliver_admin_audit_outbox(integer) is
    'Idempotently drains due admin_audit_outbox rows into admin_audit_log; failed rows remain queued with exponential backoff.';

-- Audit rows are low-volume, so a minute is a reasonable delivery bound without
-- a busy loop. cron.schedule upserts on job_name, making re-application safe.
create extension if not exists pg_cron;

select cron.schedule(
    'deliver-admin-audit-outbox',
    '* * * * *',
    $job$select public.deliver_admin_audit_outbox(100);$job$
);
