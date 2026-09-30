-- ═══════════════════════════════════════════════════════════════════════════
-- Keep the hero image in version history
--
-- `record_content_revision()` already treats a `featured_image` change as a
-- revision-worthy edit, but `content_revisions` has no column to hold it — so
-- the trigger fires, stores everything except the image, and
-- `restoreContentRevision` writes `featuredImage: null`. Restoring a version
-- silently dropped the page hero. That is the same class of bug as the
-- unconditional `storage.remove()`: a control labelled "Restore" that deletes
-- data the author did not ask to delete.
--
-- Additive and backfill-free: rows written before this migration keep
-- `featured_image = NULL`, and a restore of one of those behaves exactly as
-- before. Only revisions written after this lands carry the hero.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.content_revisions
    ADD COLUMN IF NOT EXISTS featured_image TEXT;

COMMENT ON COLUMN public.content_revisions.featured_image IS
    'Hero image at the time the revision was captured. NULL means the page had no hero, or the revision predates this column.';

CREATE OR REPLACE FUNCTION public.record_content_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.body IS DISTINCT FROM OLD.body
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.excerpt IS DISTINCT FROM OLD.excerpt
       OR NEW.featured_image IS DISTINCT FROM OLD.featured_image
       OR NEW.metadata IS DISTINCT FROM OLD.metadata THEN
        INSERT INTO public.content_revisions (
            content_id, title, slug, body, excerpt, type, status,
            featured_image, metadata, created_by
        ) VALUES (
            OLD.id, OLD.title, OLD.slug, OLD.body, OLD.excerpt, OLD.type,
            OLD.status, OLD.featured_image, OLD.metadata, auth.uid()
        );

        -- Bounded history: keep the 50 most recent per page. Without a cap this
        -- table grows by a full body copy on every keystroke-triggered save.
        DELETE FROM public.content_revisions
        WHERE content_id = OLD.id
          AND id NOT IN (
              SELECT id FROM public.content_revisions
              WHERE content_id = OLD.id
              ORDER BY created_at DESC, id DESC
              LIMIT 50
          );
    END IF;
    RETURN NEW;
END;
$$;
