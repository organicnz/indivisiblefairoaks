-- Storage bounds for the error beacon.
--
-- error_reports accepts anonymous inserts by design (client crash telemetry).
-- The /api/report-error route validates and rate-limits, but PostgREST itself
-- remains writable with the public key — without column constraints, scripted
-- multi-megabyte rows could bloat the table directly. Mirror the route's
-- schema-level caps in the database where the guarantee actually lives.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'error_reports_message_len'
  ) THEN
    ALTER TABLE public.error_reports
      ADD CONSTRAINT error_reports_message_len CHECK (char_length(message) <= 500);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'error_reports_stack_len'
  ) THEN
    ALTER TABLE public.error_reports
      ADD CONSTRAINT error_reports_stack_len CHECK (stack IS NULL OR char_length(stack) <= 2000);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'error_reports_component_stack_len'
  ) THEN
    ALTER TABLE public.error_reports
      ADD CONSTRAINT error_reports_component_stack_len CHECK (component_stack IS NULL OR char_length(component_stack) <= 1000);
  END IF;
END;
$$;
