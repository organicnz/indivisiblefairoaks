-- App-owned MFA recovery codes.
--
-- Supabase Auth's native recovery-code API is not enabled on hosted projects,
-- so the application stores only SHA-256 hashes of high-entropy codes. The
-- plaintext values are returned once when generated and never persisted.
--
-- RLS is enabled with no client policies: recovery-code reads and writes go
-- through the service-role client after the server has authenticated the user
-- and checked the relevant MFA state. A signed-in browser must never be able to
-- enumerate hashes or consume a code without the server action.

create table if not exists public.mfa_recovery_codes (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    code_hash   text not null,
    created_at  timestamptz not null default now(),
    used_at     timestamptz,
    constraint mfa_recovery_codes_user_hash_unique unique (user_id, code_hash)
);

create index if not exists mfa_recovery_codes_user_unused_idx
    on public.mfa_recovery_codes (user_id)
    where used_at is null;

alter table public.mfa_recovery_codes enable row level security;

revoke all on table public.mfa_recovery_codes from anon, authenticated;
grant all on table public.mfa_recovery_codes to service_role;

-- Replacing a set is one transaction: a failed insert must not leave the
-- account with no recovery codes after the old set was deleted.
create or replace function public.replace_mfa_recovery_codes(
    p_user_id uuid,
    p_code_hashes text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if p_user_id is null then
        raise exception 'user id required';
    end if;
    if p_code_hashes is null or cardinality(p_code_hashes) = 0 then
        raise exception 'recovery codes required';
    end if;

    delete from public.mfa_recovery_codes where user_id = p_user_id;

    insert into public.mfa_recovery_codes (user_id, code_hash)
    select p_user_id, code_hash
    from unnest(p_code_hashes) as code_hash;
end;
$$;

revoke all on function public.replace_mfa_recovery_codes(uuid, text[])
    from public, anon, authenticated;
grant execute on function public.replace_mfa_recovery_codes(uuid, text[])
    to service_role;
