-- Give every bulletin a reader destination. The archive cards previously ended
-- at a mailto link asking readers to request the full issue; the public detail
-- page and these durable fields let the chapter publish the issue itself.
--
-- `body` is plain text so the detail page never has to trust authored HTML.
-- `pdf_url` and `archive_url` are optional external copies (a hosted PDF or an
-- existing campaign archive) and are rendered as ordinary outbound links.

ALTER TABLE public.newsletters
  ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS archive_url TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'newsletters_body_length'
      AND conrelid = 'public.newsletters'::regclass
  ) THEN
    ALTER TABLE public.newsletters
      ADD CONSTRAINT newsletters_body_length CHECK (char_length(body) <= 100000);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'newsletters_pdf_url_http'
      AND conrelid = 'public.newsletters'::regclass
  ) THEN
    ALTER TABLE public.newsletters
      ADD CONSTRAINT newsletters_pdf_url_http CHECK (pdf_url IS NULL OR pdf_url ~ '^https?://');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'newsletters_archive_url_http'
      AND conrelid = 'public.newsletters'::regclass
  ) THEN
    ALTER TABLE public.newsletters
      ADD CONSTRAINT newsletters_archive_url_http CHECK (archive_url IS NULL OR archive_url ~ '^https?://');
  END IF;
END $$;

COMMENT ON COLUMN public.newsletters.body IS
  'Plain-text full issue rendered at /newsletters/{slug}. Empty means only the summary is archived.';
COMMENT ON COLUMN public.newsletters.pdf_url IS
  'Optional durable PDF copy of the issue, linked from the archive card and detail page.';
COMMENT ON COLUMN public.newsletters.archive_url IS
  'Optional durable external archive copy of the issue, linked from the archive card and detail page.';

-- The button used to promise a request-by-email flow. Update only the seeded
-- labels so an editor's deliberate custom copy is preserved.
UPDATE public.data_points
SET value = 'Read Full Issue'
WHERE key = 'news.read_bulletin'
  AND value IN ('Request Full Issue', 'Read Bulletin');
