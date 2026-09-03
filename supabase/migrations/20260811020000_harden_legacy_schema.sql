-- Harden legacy schema (found by the CI migration validation gate)
--
-- 1. handle_new_user() is SECURITY DEFINER without SET search_path = '' —
--    exploitable via search_path hijacking. Replace with an identical
--    function that pins search_path and fully qualifies schema references.
--    The existing trigger stays attached (CREATE OR REPLACE).
--
-- Note: the audiobookshelf mirror tables from 20260507000000_audiobookshelf_schema.sql
-- do not exist in this project database (they were never effective / dropped),
-- so they need no RLS hardening here; the gate baselines that file deliberately.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  )
  on conflict (email) do update
  set user_id = excluded.user_id;
  return new;
end;
$$;