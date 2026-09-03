-- catch-22-next/supabase_schema_submissions.sql

-- Contact Submissions Table
CREATE TABLE IF NOT EXISTS contact_submissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for the contact form)
-- NOTE: In a production app, you might want to use a service role or captcha to prevent spam.
DROP POLICY IF EXISTS "Anyone can submit contact form" ON contact_submissions;
CREATE POLICY "Anyone can submit contact form" ON contact_submissions FOR INSERT WITH CHECK (true);

-- Only authenticated users (admins) can view submissions
DROP POLICY IF EXISTS "Admins can view submissions" ON contact_submissions;
CREATE POLICY "Admins can view submissions" ON contact_submissions FOR SELECT USING (auth.role() = 'authenticated');
