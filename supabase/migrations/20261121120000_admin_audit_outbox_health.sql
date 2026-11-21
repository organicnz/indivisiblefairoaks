-- Tighten the durable audit outbox after it has been applied.
--
-- The health view orders by attempts before retry time so repeatedly failing
-- rows cannot be hidden by a larger healthy backlog. The original backoff
-- expression also capped attempts at 6, which tops out at 1,920 seconds even
-- though the operator-facing copy promises one hour.

create index if not exists admin_audit_outbox_attempts_idx
    on public.admin_audit_outbox (attempts desc, next_attempt_at, created_at);

-- Keep the delivery contract identical except for the retry ceiling. The
-- function is replaced rather than edited in place because migrations are
-- append-only.
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
                30 * power(2, least(item.attempts, 7))::integer
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

comment on function public.deliver_admin_audit_outbox(integer) is
    'Idempotently drains due admin_audit_outbox rows into admin_audit_log; failed rows remain queued with exponential backoff.';
