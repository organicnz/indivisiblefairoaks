-- =============================================================================
-- Content Media Hardening
-- =============================================================================
-- Fixes for the content_media table created in 20261010000000:
-- 1. Adds updated_at trigger (reusing existing touch_updated_at function)
-- 2. Fixes stale 'content-images' bucket comment to reflect actual 'media' bucket
-- 3. Tightens public RLS to published-parent content only (matches content table)
-- 4. Adds sort_order >= 0 check
-- =============================================================================

-- 1. Add updated_at trigger (reusing touch_updated_at from 20260930120000)
CREATE TRIGGER content_media_touch_updated_at
    BEFORE UPDATE ON public.content_media
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_updated_at();

-- 2. Fix stale table comment
COMMENT ON TABLE public.content_media IS
    'Media items associated with visual editor sections. Each row represents'
    ' an image or asset uploaded via the visual editor and linked to a content'
    ' page via content_id. Files are stored in the Supabase Storage bucket'
    ' "media" under the "content/" prefix.';

-- 3. Tighten public RLS: only read media whose content row is published
DROP POLICY IF EXISTS "Public can read content media" ON public.content_media;
CREATE POLICY "Public can read content media for published content"
    ON public.content_media FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.content
            WHERE content.id = content_media.content_id
              AND content.status = 'publish'
              AND (content.published_at IS NULL OR content.published_at <= now())
        )
    );

-- 4. Add sort_order check
ALTER TABLE public.content_media
    ADD CONSTRAINT content_media_sort_order_nonneg CHECK (sort_order >= 0);