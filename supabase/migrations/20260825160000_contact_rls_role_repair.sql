-- Repair orphaned RLS policy role references on contact_submissions.
--
-- Incident: anonymous contact-form inserts were rejected with
-- "new row violates row-level security policy" even though pg_policies
-- displayed a permissive INSERT policy. Root cause: both policies carried
-- EMPTY polroles sets in the catalog (pg_policies cosmetically renders empty
-- as {public}). Empty role sets match NO role, so the policies applied to
-- nobody and default-deny won. This state typically follows a project
-- restore/role recreation, which orphans policy->role OID references while
-- leaving the policy text intact.
--
-- Recreating the policies re-resolves role names to current OIDs.
-- Idempotent: safe to re-run; CI db push applies this after the migrations
-- that create the policies, and matches their intent exactly.

DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;
CREATE POLICY "Anyone can submit contact form"
  ON public.contact_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view contact submissions" ON public.contact_submissions;
CREATE POLICY "Admins can view contact submissions"
  ON public.contact_submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true
    )
  );
