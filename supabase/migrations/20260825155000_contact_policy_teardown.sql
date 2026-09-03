-- Pre-teardown for 20260825160000_contact_rls_role_repair.
--
-- The role-repair migration recreates both contact_submissions policies with
-- bare CREATE POLICY (append-only file, no OR REPLACE variant exists for
-- policies). Policies hand-applied during the incident response already
-- exist, so without this step a fresh `supabase db push` collides with
-- "policy already exists". Dropping first makes the repair replay-safe.

DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;
DROP POLICY IF EXISTS "Admins can view contact submissions" ON public.contact_submissions;
