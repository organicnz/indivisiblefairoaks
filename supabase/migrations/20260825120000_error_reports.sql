-- Client error telemetry ("error beacon").
--
-- The storefront error boundaries previously only console.error'd, so
-- production crashes were invisible unless a customer complained. This table
-- is the landing zone for the rate-limited /api/report-error route.
--
-- Privacy posture:
--   - No auth session resolution, no IP stored, no cookies read.
--   - Only what the browser error boundary already knows: message, stack,
--     Next.js digest, route path, and the request User-Agent (truncated).
--   - fingerprint = server-side SHA-256 of message + first stack frame, so
--     identical crashes group into one row family for triage.
--
-- Retention: rows are cheap and admin-only-readable; prune manually or wire
-- a scheduled cleanup later if volume ever warrants it.

CREATE TABLE public.error_reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  fingerprint text NOT NULL,
  digest text,
  message text NOT NULL,
  stack text,
  component_stack text,
  path text,
  user_agent text
);

ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX error_reports_created_at_idx ON public.error_reports (created_at DESC);
CREATE INDEX error_reports_fingerprint_idx ON public.error_reports (fingerprint);

-- Insert-only for the public: nobody can read, modify, or delete reports
-- through PostgREST regardless of session state.
CREATE POLICY "Anyone can submit an error report"
  ON public.error_reports
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Triage surface for the admin dashboard.
CREATE POLICY "Admins can view error reports"
  ON public.error_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND is_admin = TRUE
    )
  );
