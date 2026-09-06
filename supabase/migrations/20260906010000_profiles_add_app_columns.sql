-- Add application-specific columns to the Supabase default profiles table.
--
-- The remote DB uses the Supabase starter profiles schema:
--   (id UUID, updated_at, username, full_name, avatar_url, website)
--
-- Our app needs: user_id, email, is_admin, settings.
-- All statements are idempotent — safe on fresh and existing databases.

-- user_id: FK to auth.users; mirrors auth.users.id for easy lookup
-- (The default profiles.id IS auth.users.id, but explicit FK helps queries)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- email: cached from auth.users for profile lookups by email
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

-- is_admin: admin role flag
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- settings: user preferences JSONB blob
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Index for fast user_id lookups
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles(user_id);

-- Ensure RLS is enabled (it is by default on Supabase profiles)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Rebuild RLS policies to cover both id-based and user_id-based auth
DROP POLICY IF EXISTS "Users can view their own profile."  ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Primary: auth.uid() = id  (Supabase default — profiles.id = auth.users.id)
-- Secondary: auth.uid() = user_id (our FK column)
-- Tertiary: email match (legacy fallback)
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (
        auth.uid() = id
        OR auth.uid() = user_id
        OR (email IS NOT NULL AND auth.jwt()->>'email' = email)
    );

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (
        auth.uid() = id
        OR auth.uid() = user_id
        OR (email IS NOT NULL AND auth.jwt()->>'email' = email)
    );

-- Allow authenticated users to insert their own profile row
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (
        auth.uid() = id
        OR auth.uid() = user_id
    );

-- Keep service role access for admin operations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'profiles' AND policyname = 'Service role can do anything'
    ) THEN
        EXECUTE 'CREATE POLICY "Service role can do anything"
            ON public.profiles FOR ALL
            TO service_role USING (true) WITH CHECK (true)';
    END IF;
END $$;
