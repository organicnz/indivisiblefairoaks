-- =============================================================================
-- Content Media Table for Visual Editor
-- =============================================================================
-- Adds support for media items associated with visual editor sections.
-- Media is stored in Supabase Storage bucket 'content-images'.
-- =============================================================================

-- Create content_media table to track media items associated with content sections
CREATE TABLE IF NOT EXISTS public.content_media (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id      INTEGER NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    path            TEXT NOT NULL,         -- Supabase storage path
    url             TEXT NOT NULL,         -- Public URL
    mime_type       TEXT NOT NULL,
    size            INTEGER NOT NULL,
    width           INTEGER,
    height          INTEGER,
    alt_text        TEXT,
    caption         TEXT,
    folder          TEXT NOT NULL DEFAULT 'sections',
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for fast lookups by content_id
CREATE INDEX IF NOT EXISTS content_media_content_id_idx
    ON public.content_media (content_id);

-- Create index for sort order
CREATE INDEX IF NOT EXISTS content_media_sort_order_idx
    ON public.content_media (sort_order);

-- Add comment
COMMENT ON TABLE public.content_media IS
    'Media items associated with visual editor sections. Each row represents'
    ' an image or asset uploaded via the visual editor and linked to a content'
    ' page via content_id.';

-- Grant permissions
ALTER TABLE public.content_media ENABLE ROW LEVEL SECURITY;

-- Policy: Public can read media (for display on public pages)
CREATE POLICY "Public can read content media"
    ON public.content_media FOR SELECT
    USING (true);

-- Policy: Admins can manage media
CREATE POLICY "Admins can manage content media"
    ON public.content_media FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Update content table to add section tracking columns if needed
-- Add a metadata field to track section editing state
