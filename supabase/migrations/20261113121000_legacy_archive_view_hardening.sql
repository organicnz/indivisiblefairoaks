-- Supabase's project-level default privileges grant ALL on newly created
-- tables and views to anon and authenticated. RLS protects the base tables,
-- but a simple view is updatable and runs with its owner's privileges, so an
-- anon INSERT/UPDATE/DELETE grant on a public view would bypass the base RLS
-- checks. The archive is read-only for the public.
--
-- Keep authenticated DML on the base tables because the admin RLS policy is
-- still the authorization gate for CMS administrators. Service role continues
-- to bypass RLS for the importer.

REVOKE ALL PRIVILEGES ON TABLE
    public.legacy_import_runs,
    public.legacy_pages,
    public.legacy_assets,
    public.legacy_page_links,
    public.legacy_documents
FROM anon, authenticated, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public.legacy_import_runs,
    public.legacy_pages,
    public.legacy_assets,
    public.legacy_page_links,
    public.legacy_documents
TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE
    public.legacy_public_pages,
    public.legacy_public_assets,
    public.legacy_public_page_links,
    public.legacy_public_documents
FROM anon, authenticated, PUBLIC;

GRANT SELECT ON TABLE
    public.legacy_public_pages,
    public.legacy_public_assets,
    public.legacy_public_page_links,
    public.legacy_public_documents
TO anon, authenticated;

COMMENT ON VIEW public.legacy_public_pages IS
    'Read-only public view. Grant SELECT only; never DML.';
COMMENT ON VIEW public.legacy_public_assets IS
    'Read-only public view. Grant SELECT only; never DML.';
COMMENT ON VIEW public.legacy_public_page_links IS
    'Read-only public view. Grant SELECT only; never DML.';
COMMENT ON VIEW public.legacy_public_documents IS
    'Read-only public view. Grant SELECT only; never DML.';
