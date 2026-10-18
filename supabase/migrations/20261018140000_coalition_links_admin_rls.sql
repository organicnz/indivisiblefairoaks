-- Migration: 20261018140000_coalition_links_admin_rls.sql
-- Enforces complete RLS policies (insert, update, delete) for public.coalition_links
-- so that authenticated admins can add, update, and remove coalition and action links.

GRANT ALL ON public.coalition_links TO authenticated, service_role;
GRANT SELECT ON public.coalition_links TO anon;

DROP POLICY IF EXISTS "Admins can insert coalition links" ON public.coalition_links;
CREATE POLICY "Admins can insert coalition links"
    ON public.coalition_links FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update coalition links" ON public.coalition_links;
CREATE POLICY "Admins can update coalition links"
    ON public.coalition_links FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete coalition links" ON public.coalition_links;
CREATE POLICY "Admins can delete coalition links"
    ON public.coalition_links FOR DELETE
    TO authenticated
    USING (public.is_admin());
