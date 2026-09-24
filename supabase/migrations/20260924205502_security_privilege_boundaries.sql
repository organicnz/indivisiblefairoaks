ALTER FUNCTION public.crm_sync_historical_records() SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.crm_sync_historical_records() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_sync_historical_records() TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, user_id, email, first_name, last_name)
    VALUES (
        NEW.id,
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name'
    )
    ON CONFLICT (email) DO NOTHING;
    RETURN NEW;
END;
$$;
