-- Content scheduling — embargo meeting notes and announcements.
--
-- Adds an optional `published_at` embargo to public.content. Semantics:
--   status = 'publish' AND (published_at IS NULL OR published_at <= now())
-- NULL means "visible immediately", so every existing row keeps its current
-- behavior; the backfill below stamps already-published rows with their
-- creation time for an honest audit trail.
--
-- Also constrains status to the two states the app actually reads
-- ('publish' / 'draft') and evolves search_content with the same embargo
-- predicate so drafts and scheduled rows can never leak through search.
-- (CREATE OR REPLACE in a NEW file — the original FTS migration is untouched.)
--
-- Cache note: storefront reads are cached for an hour (Fluid CPU
-- conservation), so a lifted embargo propagates within the hour.
-- Idempotent: safe to re-run.

ALTER TABLE public.content
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

UPDATE public.content
  SET published_at = created_at
  WHERE status = 'publish' AND published_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'content_status_check'
  ) THEN
    ALTER TABLE public.content
      ADD CONSTRAINT content_status_check CHECK (status IN ('publish', 'draft'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS content_visibility_idx
  ON public.content (status, published_at);

CREATE OR REPLACE FUNCTION public.search_content(search_query text, max_rows int DEFAULT 10)
  RETURNS TABLE (
    id int,
    title varchar,
    slug varchar,
    type varchar,
    created_at timestamptz,
    rank real
  )
  LANGUAGE sql
  STABLE
  SET search_path = ''
  AS $$
    SELECT
      c.id,
      c.title,
      c.slug,
      c.type,
      c.created_at,
      ts_rank(c.search_vector, websearch_to_tsquery('english', search_query)) AS rank
    FROM public.content c
    WHERE c.search_vector @@ websearch_to_tsquery('english', search_query)
      AND c.status = 'publish'
      AND (c.published_at IS NULL OR c.published_at <= now())
    ORDER BY rank DESC, c.created_at DESC NULLS LAST
    LIMIT least(greatest(max_rows, 1), 50);
  $$;
