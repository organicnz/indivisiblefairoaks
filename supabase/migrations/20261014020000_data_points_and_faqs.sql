-- Migration: 20261014020000_data_points_and_faqs.sql
-- Creates public.faqs and public.data_points tables with full Row Level Security (RLS)
-- and seeds canonical data points and frequently asked questions.

-- 1. FAQs Table
CREATE TABLE IF NOT EXISTS public.faqs (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug        TEXT UNIQUE NOT NULL,
    category    TEXT NOT NULL DEFAULT '',
    question    TEXT NOT NULL,
    answer      TEXT NOT NULL,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS faqs_category_idx ON public.faqs (category);
CREATE INDEX IF NOT EXISTS faqs_sort_idx ON public.faqs (sort_order);

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public faqs viewable" ON public.faqs;
CREATE POLICY "Public faqs viewable"
    ON public.faqs FOR SELECT
    TO anon, authenticated USING (true);
GRANT SELECT ON public.faqs TO anon, authenticated;
GRANT ALL ON public.faqs TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins can insert faqs" ON public.faqs;
CREATE POLICY "Admins can insert faqs"
    ON public.faqs FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update faqs" ON public.faqs;
CREATE POLICY "Admins can update faqs"
    ON public.faqs FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete faqs" ON public.faqs;
CREATE POLICY "Admins can delete faqs"
    ON public.faqs FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 2. Data Points Table
CREATE TABLE IF NOT EXISTS public.data_points (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    group_name  TEXT NOT NULL DEFAULT 'general',
    label       TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS data_points_group_idx ON public.data_points (group_name);

ALTER TABLE public.data_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public data points viewable" ON public.data_points;
CREATE POLICY "Public data points viewable"
    ON public.data_points FOR SELECT
    TO anon, authenticated USING (true);
GRANT SELECT ON public.data_points TO anon, authenticated;
GRANT ALL ON public.data_points TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins can insert data points" ON public.data_points;
CREATE POLICY "Admins can insert data points"
    ON public.data_points FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update data points" ON public.data_points;
CREATE POLICY "Admins can update data points"
    ON public.data_points FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete data points" ON public.data_points;
CREATE POLICY "Admins can delete data points"
    ON public.data_points FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 3. Partners & Coalition Links Admin Permissions
GRANT ALL ON public.partners TO authenticated, service_role;
DROP POLICY IF EXISTS "Admins can insert partners" ON public.partners;
CREATE POLICY "Admins can insert partners"
    ON public.partners FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update partners" ON public.partners;
CREATE POLICY "Admins can update partners"
    ON public.partners FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete partners" ON public.partners;
CREATE POLICY "Admins can delete partners"
    ON public.partners FOR DELETE
    TO authenticated
    USING (public.is_admin());

GRANT ALL ON public.coalition_links TO authenticated, service_role;
DROP POLICY IF EXISTS "Admins can insert coalition links" ON public.coalition_links;
CREATE POLICY "Admins can insert coalition links"
    ON public.coalition_links FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update coalition links" ON public.coalition_links;
CREATE POLICY "Admins can update coalition links"
    ON public.coalition_links FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete coalition links" ON public.coalition_links;
CREATE POLICY "Admins can delete coalition links"
    ON public.coalition_links FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 4. Seed Canonical FAQs
INSERT INTO public.faqs (slug, category, question, answer, sort_order)
VALUES
    ('about-indivisible-fairoaks', 'About Our Chapter', 'What is Indivisible Fair Oaks-Carmichael?',
     'We are a grassroots community organization in Sacramento County, California, affiliated with the national Indivisible movement. We are dedicated to defending democracy, protecting voting rights, promoting social and climate justice, and holding our elected officials accountable.', 10),
    ('meeting-location-time', 'About Our Chapter', 'When and where are the regular chapter meetings held?',
     'We gather on the first Tuesday of every month from 6:30 PM to 8:00 PM at St. Michael''s Episcopal Church, 2140 Mission Avenue, Carmichael, CA 95608. Hybrid Zoom options are also provided for members participating remotely.', 20),
    ('residency-requirements', 'About Our Chapter', 'Do I have to live in Fair Oaks or Carmichael to join?',
     'Not at all! We welcome neighbors from Citrus Heights, Orangevale, Arden-Arcade, Rancho Cordova, Sacramento, and surrounding communities across California Congressional Districts CA-06 and CA-03.', 30),
    ('choir-audition', 'Carmichael Resistance Choir', 'Do I need to audition to join the Resistance Choir?',
     'No audition is required! All voices, experience levels, and musical backgrounds are warmly welcomed. Rehearsals are held every other Wednesday evening from 6:30 PM to 8:00 PM.', 40),
    ('choir-performance-locations', 'Carmichael Resistance Choir', 'Where does the choir perform?',
     'We sing at peaceful street corner demonstrations (such as the intersection of Fair Oaks Blvd & Manzanita Ave), civic rallies, Sacramento Capitol events, and our monthly community gatherings.', 50),
    ('contributions-tax-deductible', 'Voter Action & Contributions', 'Are contributions to Indivisible Fair Oaks tax-deductible?',
     'No. Contributions made through our ActBlue portal are dedicated to grassroots civic advocacy and political mobilization, and are therefore not tax-deductible as charitable gifts. 100% of donations fund meeting hall rentals, rally signs, and voter contact materials.', 60),
    ('postcard-writing-outreach', 'Voter Action & Contributions', 'How can I participate in postcard writing for voter turnout?',
     'We supply pre-printed postcards, verified voter addresses, and proven scripts for swing districts. Visit our Events page or email contact@indivisiblefairoaks.org to join our monthly postcarding blitzes.', 70)
ON CONFLICT (slug) DO UPDATE SET
    category = EXCLUDED.category,
    question = EXCLUDED.question,
    answer = EXCLUDED.answer,
    sort_order = EXCLUDED.sort_order;

-- 5. Seed Canonical Site Data Points
INSERT INTO public.data_points (key, value, group_name, label)
VALUES
    ('home.hero.eyebrow', 'Sacramento County Grassroots Action', 'home', 'Hero Eyebrow'),
    ('home.hero.headline', 'Democracy is not a spectator sport.', 'home', 'Hero Main Headline'),
    ('home.hero.mission', 'The mission of the Fair Oaks-Carmichael chapter of Indivisible is to cultivate a non-violent grassroots movement to stop the rise of authoritarianism, to support and defend democratic norms, elect bold leaders, and secure progressive policies.', 'home', 'Hero Mission Statement'),
    ('home.impact.neighbors', '500+', 'home', 'Impact Metric Neighbors Count'),
    ('home.impact.neighbors_label', 'Active Neighbors', 'home', 'Impact Metric Neighbors Label'),
    ('home.impact.postcards', '4,200+', 'home', 'Impact Metric Postcards Count'),
    ('home.impact.postcards_label', 'Postcards Written', 'home', 'Impact Metric Postcards Label'),
    ('home.impact.funding', '100%', 'home', 'Impact Metric Funding Percentage'),
    ('home.impact.funding_label', 'Grassroots Funded', 'home', 'Impact Metric Funding Label'),
    ('home.impact.districts', 'CA-03 / 06', 'home', 'Impact Metric Districts Code'),
    ('home.impact.districts_label', 'Congressional Districts', 'home', 'Impact Metric Districts Label'),
    ('about.mission.headline', 'Our Mission & Core Values', 'about', 'About Mission Title'),
    ('about.who.headline', 'Who We Are', 'about', 'About Who Title'),
    ('voter.guides.headline', '2026 Voter Guide & Ballot Recommendations', 'voter', 'Voter Guides Title'),
    ('choir.schedule.headline', 'Rehearsal Schedule & Guidelines', 'choir', 'Choir Schedule Title'),
    ('donate.impact.headline', 'Where Your Donation Goes', 'donate', 'Donate Impact Title')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    group_name = EXCLUDED.group_name,
    label = EXCLUDED.label;
