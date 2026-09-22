-- =============================================================================
-- Add missing columns to profiles & fix handle_new_user trigger
-- Aligns the live schema with the canonical schema definition.
--
-- Missing columns: first_name, last_name, created_at
-- Also re-creates handle_new_user() so it writes first_name/last_name from
-- user metadata on signup.
-- =============================================================================

-- ── Add missing columns ─────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name  TEXT,
  ADD COLUMN IF NOT EXISTS last_name   TEXT,
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT now();

-- ── Re-create handle_new_user trigger function ──────────────────────────────
-- Canonical version: inserts id, user_id, email, first_name, last_name.
-- ON CONFLICT (email) upserts so CRM-seeded rows get linked to their auth user.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, user_id, email, first_name, last_name)
    VALUES (
        NEW.id,
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name'
    )
    ON CONFLICT (email) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            id      = EXCLUDED.id;
    RETURN NEW;
END;
$$;
