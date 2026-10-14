-- Migration: 20261014010000_civic_data_rls.sql
-- Enforces complete RLS policies (insert, update, delete) for public.events and public.newsletters
-- and ensures all civic bulletins and updates are stored in the Supabase database.

-- 1. Events permissions & policies
GRANT ALL ON public.events TO authenticated, service_role;
GRANT SELECT ON public.events TO anon;

DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
CREATE POLICY "Admins can insert events"
    ON public.events FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update events" ON public.events;
CREATE POLICY "Admins can update events"
    ON public.events FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete events" ON public.events;
CREATE POLICY "Admins can delete events"
    ON public.events FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 2. Newsletters permissions & policies
GRANT ALL ON public.newsletters TO authenticated, service_role;
GRANT SELECT ON public.newsletters TO anon;

DROP POLICY IF EXISTS "Admins can insert newsletters" ON public.newsletters;
CREATE POLICY "Admins can insert newsletters"
    ON public.newsletters FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update newsletters" ON public.newsletters;
CREATE POLICY "Admins can update newsletters"
    ON public.newsletters FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete newsletters" ON public.newsletters;
CREATE POLICY "Admins can delete newsletters"
    ON public.newsletters FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 3. Upsert canonical newsletter records
INSERT INTO public.newsletters (slug, title, date_label, description, topics, sort_order, published_at)
VALUES
    ('summer-action-bulletin-2026', 'Indivisible Fair Oaks-Carmichael Summer Action Bulletin', 'July 2026',
     'Summer organizing priorities: preparing for upcoming elections, choir street demonstrations at Fair Oaks & Manzanita, local food bank drives, and phone-banking schedules.',
     ARRAY['Election Defense', 'Choir Actions', 'Food Drive', 'Mobilize Events'], 10, '2026-07-01T00:00:00Z'),
    ('mid-year-grassroots-review-2026', 'Mid-Year Grassroots Review & Legislative Round-up', 'June 2026',
     'Review of California state legislative priorities, local city council actions, deep canvass voter persuasion results, and upcoming coalition rallies in Citrus Heights.',
     ARRAY['California Bills', 'Deep Canvass', 'Sunrise Solidarity', 'Voter Outreach'], 20, '2026-06-01T00:00:00Z'),
    ('spring-mobilization-choir-launch-2026', 'Spring Mobilization & Resistance Choir Launch', 'May 2026',
     'Announcing the official schedule for the Carmichael Resistance Choir, spring town hall debriefs, and youth voter pre-registration drives across Sacramento County.',
     ARRAY['Resistance Choir', 'Youth Pre-Registration', 'Town Halls'], 30, '2026-05-01T00:00:00Z'),
    ('defending-democratic-norms-spring-2026', 'Defending Democratic Norms: Spring Chapter Newsletter', 'April 2026',
     'National Indivisible strategy updates, local community resistance workshops, and mutual aid efforts for Fair Oaks and Carmichael neighborhood families.',
     ARRAY['National Strategy', 'Mutual Aid', 'Community Care'], 40, '2026-04-01T00:00:00Z')
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    date_label = EXCLUDED.date_label,
    description = EXCLUDED.description,
    topics = EXCLUDED.topics,
    sort_order = EXCLUDED.sort_order,
    published_at = EXCLUDED.published_at;
