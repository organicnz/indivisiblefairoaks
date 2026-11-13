-- Legacy Google Sites archive.
--
-- The old site is preserved in two layers:
--   * legacy-archive (private) stores the raw page HTML, screenshots and every
--     downloaded asset. Nothing in it is publicly addressable.
--   * legacy-documents (public) stores only files the chapter has the right to
--     republish. Third-party and unknown-rights files stay private and link to
--     their original source instead.
--
-- The public archive reads approved rows from legacy_pages/legacy_assets/
-- legacy_documents. The import script writes through the service role, so no
-- public write policy exists. All tables deliberately get RLS even though the
-- importer bypasses it: a later dashboard write must not be able to expose rows
-- to anon.

CREATE TABLE IF NOT EXISTS public.legacy_import_runs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source           TEXT NOT NULL,
    source_label     TEXT NOT NULL DEFAULT '',
    manifest_sha256  TEXT NOT NULL,
    manifest_path    TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'running'
                     CHECK (status IN ('running', 'succeeded', 'failed')),
    page_count       INT NOT NULL DEFAULT 0,
    asset_count      INT NOT NULL DEFAULT 0,
    document_count   INT NOT NULL DEFAULT 0,
    notes            TEXT,
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS legacy_import_runs_started_idx
    ON public.legacy_import_runs (started_at DESC);

ALTER TABLE public.legacy_import_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage legacy import runs" ON public.legacy_import_runs;
CREATE POLICY "Admins manage legacy import runs"
    ON public.legacy_import_runs FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.legacy_pages (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_run_id  UUID REFERENCES public.legacy_import_runs(id) ON DELETE SET NULL,
    source_path    TEXT NOT NULL UNIQUE,
    source_url     TEXT NOT NULL,
    title          TEXT NOT NULL,
    page_kind      TEXT NOT NULL DEFAULT 'page',
    destination    TEXT NOT NULL DEFAULT '',
    summary        TEXT NOT NULL DEFAULT '',
    body_text      TEXT NOT NULL DEFAULT '',
    raw_html_path  TEXT,
    screenshot_path TEXT,
    status         TEXT NOT NULL DEFAULT 'approved'
                   CHECK (status IN ('draft', 'review', 'approved', 'hidden')),
    captured_at    TIMESTAMPTZ,
    sort_order     INT NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legacy_pages_import_run_idx
    ON public.legacy_pages (import_run_id);
CREATE INDEX IF NOT EXISTS legacy_pages_public_idx
    ON public.legacy_pages (status, sort_order)
    WHERE status = 'approved';

ALTER TABLE public.legacy_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage legacy pages" ON public.legacy_pages;
CREATE POLICY "Admins manage legacy pages"
    ON public.legacy_pages FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.legacy_assets (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_run_id    UUID REFERENCES public.legacy_import_runs(id) ON DELETE SET NULL,
    asset_key        TEXT NOT NULL UNIQUE,
    source_page_path TEXT NOT NULL,
    source_url       TEXT NOT NULL,
    kind             TEXT NOT NULL,
    drive_id         TEXT,
    youtube_id       TEXT,
    filename         TEXT,
    storage_path     TEXT,
    public_path      TEXT,
    -- Full public URL when an existing media object is reused instead of
    -- duplicating the same image into legacy-documents.
    public_url       TEXT,
    external_url     TEXT,
    sha256           TEXT,
    byte_size        BIGINT,
    mime_type        TEXT,
    width            INT,
    height           INT,
    alt_text         TEXT,
    caption          TEXT,
    rights           TEXT NOT NULL DEFAULT 'unknown'
                     CHECK (rights IN ('chapter_owned', 'third_party', 'public_domain', 'unknown')),
    blocked_reason   TEXT,
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'stored', 'external', 'blocked', 'failed')),
    is_public        BOOLEAN NOT NULL DEFAULT false,
    sort_order       INT NOT NULL DEFAULT 0,
    captured_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legacy_assets_import_run_idx
    ON public.legacy_assets (import_run_id);
CREATE INDEX IF NOT EXISTS legacy_assets_page_idx
    ON public.legacy_assets (source_page_path);
CREATE INDEX IF NOT EXISTS legacy_assets_public_idx
    ON public.legacy_assets (is_public, kind)
    WHERE is_public = true;

ALTER TABLE public.legacy_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage legacy assets" ON public.legacy_assets;
CREATE POLICY "Admins manage legacy assets"
    ON public.legacy_assets FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.legacy_page_links (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id     UUID NOT NULL REFERENCES public.legacy_pages(id) ON DELETE CASCADE,
    asset_id    UUID REFERENCES public.legacy_assets(id) ON DELETE SET NULL,
    href        TEXT NOT NULL,
    label       TEXT NOT NULL DEFAULT '',
    kind        TEXT NOT NULL DEFAULT 'link',
    is_external BOOLEAN NOT NULL DEFAULT false,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (page_id, href)
);

CREATE INDEX IF NOT EXISTS legacy_page_links_page_idx
    ON public.legacy_page_links (page_id);
CREATE INDEX IF NOT EXISTS legacy_page_links_asset_idx
    ON public.legacy_page_links (asset_id);

ALTER TABLE public.legacy_page_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage legacy page links" ON public.legacy_page_links;
CREATE POLICY "Admins manage legacy page links"
    ON public.legacy_page_links FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.legacy_documents (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_run_id    UUID REFERENCES public.legacy_import_runs(id) ON DELETE SET NULL,
    asset_id         UUID UNIQUE REFERENCES public.legacy_assets(id) ON DELETE SET NULL,
    slug             TEXT NOT NULL UNIQUE,
    title            TEXT NOT NULL,
    category         TEXT NOT NULL DEFAULT 'other',
    description      TEXT NOT NULL DEFAULT '',
    source_page_path TEXT NOT NULL DEFAULT '',
    file_path        TEXT,
    public_url       TEXT,
    external_url     TEXT,
    mime_type        TEXT,
    byte_size        BIGINT,
    sha256           TEXT,
    rights           TEXT NOT NULL DEFAULT 'unknown'
                     CHECK (rights IN ('chapter_owned', 'third_party', 'public_domain', 'unknown')),
    published_at     TIMESTAMPTZ,
    status           TEXT NOT NULL DEFAULT 'approved'
                     CHECK (status IN ('draft', 'review', 'approved', 'hidden')),
    sort_order       INT NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legacy_documents_import_run_idx
    ON public.legacy_documents (import_run_id);
CREATE INDEX IF NOT EXISTS legacy_documents_public_idx
    ON public.legacy_documents (status, category, sort_order)
    WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS legacy_documents_source_idx
    ON public.legacy_documents (source_page_path);

ALTER TABLE public.legacy_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage legacy documents" ON public.legacy_documents;
CREATE POLICY "Admins manage legacy documents"
    ON public.legacy_documents FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Public views are the only anon-readable surface. Keeping the base tables
-- admin-only prevents private storage paths (and unfinished source rows) from
-- being selected through PostgREST even though the buckets themselves are
-- private.
CREATE OR REPLACE VIEW public.legacy_public_pages AS
SELECT
    id,
    source_path,
    source_url,
    title,
    page_kind,
    destination,
    summary,
    body_text,
    captured_at,
    sort_order
FROM public.legacy_pages
WHERE status = 'approved';

CREATE OR REPLACE VIEW public.legacy_public_assets AS
SELECT
    a.id,
    a.source_page_path,
    a.source_url,
    a.kind,
    a.drive_id,
    a.youtube_id,
    a.filename,
    a.public_path,
    a.public_url,
    a.external_url,
    a.byte_size,
    a.mime_type,
    a.width,
    a.height,
    a.alt_text,
    a.caption,
    a.rights,
    a.status,
    a.sort_order
FROM public.legacy_assets a
WHERE a.is_public = true
  AND EXISTS (
      SELECT 1 FROM public.legacy_pages p
      WHERE p.source_path = a.source_page_path
        AND p.status = 'approved'
  );

CREATE OR REPLACE VIEW public.legacy_public_page_links AS
SELECT
    l.id,
    l.page_id,
    l.asset_id,
    l.href,
    l.label,
    l.kind,
    l.is_external,
    l.sort_order
FROM public.legacy_page_links l
JOIN public.legacy_pages p ON p.id = l.page_id
WHERE p.status = 'approved';

CREATE OR REPLACE VIEW public.legacy_public_documents AS
SELECT
    d.id,
    d.slug,
    d.title,
    d.category,
    d.description,
    d.source_page_path,
    d.file_path,
    d.public_url,
    d.external_url,
    d.mime_type,
    d.byte_size,
    d.rights,
    d.published_at,
    d.sort_order,
    a.drive_id,
    a.youtube_id
FROM public.legacy_documents d
LEFT JOIN public.legacy_assets a ON a.id = d.asset_id
WHERE d.status = 'approved';

GRANT SELECT ON public.legacy_public_pages TO anon, authenticated;
GRANT SELECT ON public.legacy_public_assets TO anon, authenticated;
GRANT SELECT ON public.legacy_public_page_links TO anon, authenticated;
GRANT SELECT ON public.legacy_public_documents TO anon, authenticated;

-- Two buckets: private raw preservation and public cleared documents.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('legacy-archive', 'legacy-archive', false, 524288000, NULL),
    (
        'legacy-documents',
        'legacy-documents',
        true,
        52428800,
        ARRAY[
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'video/mp4',
            'audio/mpeg',
            'audio/ogg',
            'text/plain'
        ]
    )
ON CONFLICT (id) DO UPDATE
SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public reads cleared legacy documents" ON storage.objects;
CREATE POLICY "Public reads cleared legacy documents"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'legacy-documents');

DROP POLICY IF EXISTS "Admins manage legacy archive objects" ON storage.objects;
CREATE POLICY "Admins manage legacy archive objects"
    ON storage.objects FOR ALL
    TO authenticated
    USING (bucket_id IN ('legacy-archive', 'legacy-documents') AND public.is_admin())
    WITH CHECK (bucket_id IN ('legacy-archive', 'legacy-documents') AND public.is_admin());

COMMENT ON TABLE public.legacy_pages IS
    'Approved legacy Google Sites page text. Raw HTML stays in the private legacy-archive bucket.';
COMMENT ON TABLE public.legacy_assets IS
    'Every asset found on the legacy site. Raw copies are private; is_public is only true for cleared material.';
COMMENT ON TABLE public.legacy_documents IS
    'Public document index. file_path is set only for chapter-owned files copied to legacy-documents; otherwise external_url points at the original.';
