-- Create profiles table before any migrations that depend on it.
-- Timestamp 20240430000003 places this between the inventory functions (001)
-- and the user_settings migration (005) which references profiles.email.
--
-- Idempotent: safe to run on existing DBs that already have the table.

CREATE TABLE IF NOT EXISTS public.profiles (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    is_admin BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
