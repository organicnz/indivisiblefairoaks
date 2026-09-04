-- =============================================================================
-- Indivisible Fair Oaks-Carmichael: Complete Database Schema
-- Project: mojsubkqjdruhpxbzgme
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mojsubkqjdruhpxbzgme/sql/new
-- =============================================================================

-- 1. Profiles Table (Auth Users & Admins)
CREATE TABLE IF NOT EXISTS public.profiles (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    is_admin BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles 
    FOR SELECT USING (auth.uid() = user_id OR auth.jwt()->>'email' = email);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles 
    FOR UPDATE USING (auth.uid() = user_id OR auth.jwt()->>'email' = email);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true));

-- Trigger for new auth signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  )
  ON CONFLICT (email) DO UPDATE
  SET user_id = EXCLUDED.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Content Table (Civic Pages, Actions, Announcements, Articles)
CREATE TABLE IF NOT EXISTS public.content (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    body TEXT,
    excerpt TEXT,
    type VARCHAR(50) DEFAULT 'page', -- 'page', 'post', 'action', 'event'
    status VARCHAR(50) DEFAULT 'publish',
    published_at TIMESTAMPTZ, -- NULL = visible immediately when status is 'publish'
    featured_image TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT content_status_check CHECK (status IN ('publish', 'draft'))
);

ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public content is viewable by everyone" ON public.content;
CREATE POLICY "Public content is viewable by everyone" ON public.content 
    FOR SELECT USING (status = 'publish' OR auth.role() = 'authenticated');

-- 3. Contact Submissions Table (Inquiries with honeypot & dispatch state)
CREATE TABLE IF NOT EXISTS public.contact_submissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    wants_copy BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;
CREATE POLICY "Anyone can submit contact form" ON public.contact_submissions 
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view contact submissions" ON public.contact_submissions;
CREATE POLICY "Admins can view contact submissions" ON public.contact_submissions 
    FOR SELECT TO authenticated 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true));

-- 4. Error Reports Table (Telemetry & Crash Monitoring)
CREATE TABLE IF NOT EXISTS public.error_reports (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fingerprint TEXT NOT NULL,
    digest TEXT,
    message TEXT NOT NULL,
    stack TEXT,
    component_stack TEXT,
    path TEXT,
    user_agent TEXT,
    category TEXT NOT NULL DEFAULT 'other'
);

ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS error_reports_created_at_idx ON public.error_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS error_reports_fingerprint_idx ON public.error_reports (fingerprint);

DROP POLICY IF EXISTS "Anyone can submit an error report" ON public.error_reports;
CREATE POLICY "Anyone can submit an error report" ON public.error_reports 
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view error reports" ON public.error_reports;
CREATE POLICY "Admins can view error reports" ON public.error_reports 
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true));

-- 5. Full-Text Search Function
CREATE OR REPLACE FUNCTION public.search_content(query_text TEXT)
RETURNS SETOF public.content
LANGUAGE sql STABLE
AS $$
  SELECT *
  FROM public.content
  WHERE status = 'publish'
    AND (
      to_tsvector('english', title || ' ' || coalesce(body, '')) @@ plainto_tsquery('english', query_text)
      OR title ILIKE '%' || query_text || '%'
      OR body ILIKE '%' || query_text || '%'
    )
  ORDER BY created_at DESC
  LIMIT 20;
$$;
