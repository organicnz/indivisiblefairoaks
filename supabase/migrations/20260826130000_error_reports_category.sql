-- Error beacon categorization — triage without reading every stack.
--
-- The /api/report-error route now accepts an optional `category` enum
-- (runtime, build, deploy, ui, api, database, network, auth, stripe,
-- supabase, other; defaults to 'other'). This migration adds the column to
-- live databases provisioned before the schema change, with a CHECK
-- constraint mirroring the route's zod enum so direct PostgREST writes
-- cannot inject arbitrary values.
--
-- Idempotent: safe to re-run. Fresh provisions get the column from
-- schema_indivisible.sql; this covers existing projects.

ALTER TABLE public.error_reports
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'error_reports_category_check'
  ) THEN
    ALTER TABLE public.error_reports
      ADD CONSTRAINT error_reports_category_check CHECK (
        category = ANY (ARRAY['runtime'::text, 'build'::text, 'deploy'::text, 'ui'::text, 'api'::text, 'database'::text, 'network'::text, 'auth'::text, 'stripe'::text, 'supabase'::text, 'other'::text])
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS error_reports_category_idx
  ON public.error_reports (category, created_at DESC);
