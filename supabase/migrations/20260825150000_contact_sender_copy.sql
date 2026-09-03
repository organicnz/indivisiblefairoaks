-- Contact form "send me a copy" opt-in.
--
-- Stores the submitter's preference alongside the submission so the
-- notify-contact Edge Function can mirror the message back to them when it
-- claims the row. The copy recipient is ALWAYS the row's own email column —
-- never client-supplied per-request — so the feature cannot be turned into a
-- spam relay against arbitrary addresses.

ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS wants_copy boolean NOT NULL DEFAULT false;
