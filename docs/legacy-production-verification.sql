-- Legacy archive production verification.
--
-- Run in the Supabase SQL editor (or through the Management API) with the
-- service role. Every statement is read-only.
--
-- Phase 1 is safe immediately after the migration, before the import.
-- Phase 2 is the post-import check. The expected counts describe the reviewed
-- 2026-11-13 manifest; any difference is a placement failure to investigate,
-- not something to silently accept.

-- ===========================================================================
-- PHASE 1 — migration applied, import not yet run
-- ===========================================================================

-- 1.1 Migration history: exactly three rows.
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version IN ('20261113120000', '20261113121000', '20261113122000')
ORDER BY version;

-- 1.2 Base tables and public views exist. Every value must be true.
SELECT
    to_regclass('public.legacy_import_runs')      IS NOT NULL AS import_runs,
    to_regclass('public.legacy_pages')            IS NOT NULL AS pages,
    to_regclass('public.legacy_assets')           IS NOT NULL AS assets,
    to_regclass('public.legacy_page_links')       IS NOT NULL AS page_links,
    to_regclass('public.legacy_documents')        IS NOT NULL AS documents,
    to_regclass('public.legacy_public_pages')     IS NOT NULL AS public_pages,
    to_regclass('public.legacy_public_assets')    IS NOT NULL AS public_assets,
    to_regclass('public.legacy_public_page_links') IS NOT NULL AS public_page_links,
    to_regclass('public.legacy_public_documents') IS NOT NULL AS public_documents;

-- 1.3 Both buckets exist with the intended visibility.
-- Expected: legacy-archive | false, legacy-documents | true.
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('legacy-archive', 'legacy-documents')
ORDER BY id;

-- 1.4 RLS is enabled on every base table. Every value must be true.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
      'legacy_import_runs',
      'legacy_pages',
      'legacy_assets',
      'legacy_page_links',
      'legacy_documents'
  )
ORDER BY c.relname;

-- 1.5 Storage policies exist, and only the cleared bucket has an anon read policy.
-- Expected: 2 rows.
SELECT policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname IN (
      'Public reads cleared legacy documents',
      'Admins manage legacy archive objects'
  )
ORDER BY policyname;

-- 1.6 The four public views grant only SELECT to anon and authenticated.
-- Expected: 8 rows, all privilege_type = SELECT, and 0 non-SELECT grants.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
      'legacy_public_pages',
      'legacy_public_assets',
      'legacy_public_page_links',
      'legacy_public_documents'
  )
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;

SELECT count(*) AS non_select_view_grants
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
      'legacy_public_pages',
      'legacy_public_assets',
      'legacy_public_page_links',
      'legacy_public_documents'
  )
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type <> 'SELECT';

-- 1.6b Anon has no privileges at all on the base tables.
-- Expected: 0.
SELECT count(*) AS anon_base_grants
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
      'legacy_import_runs',
      'legacy_pages',
      'legacy_assets',
      'legacy_page_links',
      'legacy_documents'
  )
  AND grantee = 'anon';

-- 1.7 Migration-only state: all five base tables are empty.
SELECT
    (SELECT count(*) FROM public.legacy_import_runs) AS import_runs,
    (SELECT count(*) FROM public.legacy_pages) AS pages,
    (SELECT count(*) FROM public.legacy_assets) AS assets,
    (SELECT count(*) FROM public.legacy_page_links) AS page_links,
    (SELECT count(*) FROM public.legacy_documents) AS documents;

-- 1.8 Archive footer copy is seeded. Expected: two rows.
SELECT key, value
FROM public.data_points
WHERE key IN ('footer.nav.archive', 'footer.bottom.archive')
ORDER BY key;

-- ===========================================================================
-- PHASE 2 — import committed with the reviewed manifest
-- ===========================================================================

-- 2.1 Exact row counts. Every "ok" must be true.
-- Expected: 9 pages, 71 assets, 20 documents, 27 links, 49 public assets,
-- 17 public documents, 27 public links, one successful import run.
SELECT x.object, x.actual, x.expected, (x.actual = x.expected) AS ok
FROM (VALUES
    ('legacy_pages',              (SELECT count(*) FROM public.legacy_pages), 9),
    ('legacy_assets',             (SELECT count(*) FROM public.legacy_assets), 71),
    ('legacy_documents',          (SELECT count(*) FROM public.legacy_documents), 20),
    ('legacy_page_links',         (SELECT count(*) FROM public.legacy_page_links), 27),
    ('legacy_public_pages',       (SELECT count(*) FROM public.legacy_public_pages), 9),
    ('legacy_public_assets',      (SELECT count(*) FROM public.legacy_public_assets), 49),
    ('legacy_public_documents',   (SELECT count(*) FROM public.legacy_public_documents), 17),
    ('legacy_public_page_links',  (SELECT count(*) FROM public.legacy_public_page_links), 27),
    ('successful_import_runs',    (
        SELECT count(*) FROM public.legacy_import_runs WHERE status = 'succeeded'
    ), 1)
) AS x(object, actual, expected)
ORDER BY x.object;

-- 2.2 Asset status: 62 stored, 6 external, 3 blocked, 0 failed.
SELECT status, count(*) AS rows
FROM public.legacy_assets
GROUP BY status
ORDER BY status;

-- 2.3 Public/private split: 49 public, 22 private or source-only.
SELECT is_public, count(*) AS rows
FROM public.legacy_assets
GROUP BY is_public
ORDER BY is_public;

-- 2.4 Documents: 17 approved, 3 held for review.
SELECT status, count(*) AS rows
FROM public.legacy_documents
GROUP BY status
ORDER BY status;

-- 2.5 Hosted vs source-only documents.
-- Expected: 3 with a file_path, 14 approved source-only, 3 blocked review rows.
SELECT
    count(*) FILTER (WHERE status = 'approved' AND file_path IS NOT NULL) AS hosted,
    count(*) FILTER (
        WHERE status = 'approved' AND file_path IS NULL AND external_url IS NOT NULL
    ) AS source_only,
    count(*) FILTER (WHERE status = 'review') AS blocked_review
FROM public.legacy_documents;

-- 2.6 The import run must report the same 9/71/20 counts.
SELECT status, page_count, asset_count, document_count, finished_at
FROM public.legacy_import_runs
ORDER BY started_at DESC
LIMIT 1;

-- 2.7 Public page matrix in display order.
SELECT source_path, title, page_kind, destination, sort_order
FROM public.legacy_public_pages
ORDER BY sort_order;

-- 2.8 No unapproved document is readable through the public view.
SELECT count(*) AS unapproved_documents_exposed
FROM public.legacy_public_documents v
JOIN public.legacy_documents d ON d.id = v.id
WHERE d.status <> 'approved';

-- 2.9 No private or blocked asset is readable through the public view.
SELECT count(*) AS private_assets_exposed
FROM public.legacy_public_assets v
JOIN public.legacy_assets a ON a.id = v.id
WHERE a.is_public = false OR a.status = 'blocked';

-- 2.10 No public asset points at a raw private storage key.
SELECT count(*) AS raw_keys_in_public_view
FROM public.legacy_public_assets
WHERE public_path LIKE 'raw/%';

-- 2.11 Every hosted public file exists in storage.
-- Expected: 0 missing.
SELECT count(*) AS missing_public_objects
FROM public.legacy_public_assets a
LEFT JOIN storage.objects o
  ON o.bucket_id = 'legacy-documents'
 AND o.name = a.public_path
WHERE a.public_path IS NOT NULL
  AND o.id IS NULL;

-- 2.12 Every approved hosted document exists in storage.
-- Expected: 0 missing.
SELECT count(*) AS missing_hosted_documents
FROM public.legacy_documents d
LEFT JOIN storage.objects o
  ON o.bucket_id = 'legacy-documents'
 AND o.name = d.file_path
WHERE d.status = 'approved'
  AND d.file_path IS NOT NULL
  AND o.id IS NULL;

-- 2.13 Every approved document has somewhere to send the reader.
-- Expected: 0.
SELECT count(*) AS approved_documents_without_destination
FROM public.legacy_documents
WHERE status = 'approved'
  AND file_path IS NULL
  AND public_url IS NULL
  AND external_url IS NULL;

-- 2.14 Storage object counts. Informational, but expected after the reviewed run:
-- legacy-archive: 80 (62 stored assets + 9 page captures + 9 screenshots)
-- legacy-documents: 13 (10 images + 3 documents)
SELECT bucket_id, count(*) AS objects
FROM storage.objects
WHERE bucket_id IN ('legacy-archive', 'legacy-documents')
GROUP BY bucket_id
ORDER BY bucket_id;

-- 2.15 Final pass/fail summary. Every value must be true.
SELECT
    (SELECT count(*) FROM public.legacy_pages) = 9 AS pages_ok,
    (SELECT count(*) FROM public.legacy_assets) = 71 AS assets_ok,
    (SELECT count(*) FROM public.legacy_documents) = 20 AS documents_ok,
    (SELECT count(*) FROM public.legacy_public_pages) = 9 AS public_pages_ok,
    (SELECT count(*) FROM public.legacy_public_assets) = 49 AS public_assets_ok,
    (SELECT count(*) FROM public.legacy_public_documents) = 17 AS public_documents_ok,
    (SELECT count(*) FROM public.legacy_public_page_links) = 27 AS public_links_ok,
    NOT EXISTS (
        SELECT 1 FROM public.legacy_public_documents v
        JOIN public.legacy_documents d ON d.id = v.id
        WHERE d.status <> 'approved'
    ) AS no_unapproved_documents,
    NOT EXISTS (
        SELECT 1 FROM public.legacy_public_assets v
        JOIN public.legacy_assets a ON a.id = v.id
        WHERE a.is_public = false OR a.status = 'blocked'
    ) AS no_private_assets,
    NOT EXISTS (
        SELECT 1
        FROM public.legacy_public_assets a
        LEFT JOIN storage.objects o
          ON o.bucket_id = 'legacy-documents'
         AND o.name = a.public_path
        WHERE a.public_path IS NOT NULL AND o.id IS NULL
    ) AS public_files_present,
    NOT EXISTS (
        SELECT 1
        FROM public.legacy_documents d
        LEFT JOIN storage.objects o
          ON o.bucket_id = 'legacy-documents'
         AND o.name = d.file_path
        WHERE d.status = 'approved' AND d.file_path IS NOT NULL AND o.id IS NULL
    ) AS hosted_documents_present,
    NOT EXISTS (
        SELECT 1
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND table_name IN (
              'legacy_public_pages',
              'legacy_public_assets',
              'legacy_public_page_links',
              'legacy_public_documents'
          )
          AND grantee IN ('anon', 'authenticated')
          AND privilege_type <> 'SELECT'
    ) AS views_select_only,
    NOT EXISTS (
        SELECT 1
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND table_name IN (
              'legacy_import_runs',
              'legacy_pages',
              'legacy_assets',
              'legacy_page_links',
              'legacy_documents'
          )
          AND grantee = 'anon'
    ) AS no_anon_base_grants;
