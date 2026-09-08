-- Fix infinite recursion in profiles RLS policies.
-- The "Admins can read all profiles" policy was querying profiles
-- from within a profiles policy, causing infinite recursion (code 42P17).
-- Solution: a SECURITY DEFINER helper function bypasses RLS on the sub-query.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND is_admin = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Recreate the problematic policy using the helper function.
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin());
