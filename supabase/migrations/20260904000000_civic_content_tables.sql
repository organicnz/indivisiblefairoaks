-- Civic content tables — move hardcoded chapter data into Supabase.
--
-- Replaces inline arrays in:
--   src/app/news/page.tsx (NEWSLETTERS)
--   src/components/ui/InteractiveEventsCalendar.tsx (EVENTS)
--   src/app/partners/page.tsx (partners)
--   src/app/links/page.tsx (LINKS_DATA)
--
-- Design:
--   * Curated public content: world-readable via anon SELECT, writes via
--     service_role only (admin / dashboard). No public INSERT/UPDATE.
--   * slug TEXT PRIMARY KEY — stable, matches existing hardcoded ids.
--   * sort_order INT — explicit display order, avoids created_at coupling.
--   * Seeded from the exact hardcoded rows the pages render today, so the
--     migration is behavior-preserving. ON CONFLICT DO NOTHING keeps
--     re-runs from clobbering editor changes.
--   * Storefront reads are cached for an hour (Fluid CPU conservation, see
--     src/lib/queries/civic.ts), so dashboard edits propagate within the hour
--     or immediately via updateTag('events' | 'partners' | ...).
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------- events ---
CREATE TABLE IF NOT EXISTS public.events (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN ('Meetings', 'Resistance Choir', 'Voter Mobilization', 'Rallies & Street Action')),
  date_label TEXT NOT NULL,
  time_label TEXT NOT NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  location_name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  rsvp_url TEXT NOT NULL DEFAULT '',
  highlight BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_sort_idx ON public.events (sort_order, starts_at);
CREATE INDEX IF NOT EXISTS events_category_idx ON public.events (category);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public events viewable" ON public.events;
CREATE POLICY "Public events viewable"
  ON public.events
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.events TO anon, authenticated;

INSERT INTO public.events
  (slug, title, category, date_label, time_label, starts_at, ends_at, location_name, address, description, rsvp_url, highlight, sort_order)
VALUES
  ('monthly-gathering-sep', 'Monthly Chapter Gathering & Food Bank Drive', 'Meetings',
   'Tuesday, September 1, 2026', '6:30 PM – 8:00 PM',
   '2026-09-01T18:30:00-07:00', '2026-09-01T20:00:00-07:00',
   'St. Michael''s Episcopal Church', '2140 Mission Avenue, Carmichael, CA 95608',
   'Our primary monthly community gathering. Agenda includes federal and local election strategies, organizing updates, and a food drive for our neighborhood pantry. Please bring canned or non-perishable goods.',
   'https://www.mobilize.us/indivisible/', true, 10),
  ('good-trouble-weekend', 'Good Trouble Lives On! Weekend of Action', 'Rallies & Street Action',
   'Friday–Sunday, July 17–19, 2026', '10:00 AM – 2:00 PM Daily',
   '2026-07-17T10:00:00-07:00', '2026-07-19T14:00:00-07:00',
   'Fair Oaks & Carmichael Public Squares', 'Fair Oaks Blvd & Manzanita Ave, Carmichael, CA',
   'Honoring John Lewis through direct community presence, voter rights education, and deep canvassing around voter protection.',
   'https://www.goodtroubleliveson.org/', true, 20),
  ('choir-rehearsal-biweekly', 'Carmichael Resistance Choir Bi-Weekly Rehearsal', 'Resistance Choir',
   'Every Other Wednesday', '6:30 PM – 8:00 PM',
   '2026-09-09T18:30:00-07:00', '2026-09-09T20:00:00-07:00',
   'Community Center / Church Hall', 'Carmichael, CA (Address provided upon registration)',
   'Learn 4-part harmonies, freedom anthems, and chants of resistance. No auditions or singing experience required — all voices are warmly welcomed!',
   'mailto:contact@indivisiblefairoaks.org?subject=Join%20Resistance%20Choir', false, 30),
  ('weekend-protest-song', 'Weekend of Protest Song Demonstration', 'Resistance Choir',
   'Saturday Afternoon Rush', '3:00 PM – 4:30 PM',
   '2026-09-19T15:00:00-07:00', '2026-09-19T16:30:00-07:00',
   'Carmichael Corner Demonstration', 'Corner of Fair Oaks Blvd & Manzanita Ave, Carmichael, CA',
   'Singing protest to afternoon traffic and community patrons. Bring your signs, lawn chairs, and voices to stand up for democracy!',
   'https://www.mobilize.us/indivisible/event/1011420/', false, 40),
  ('deep-canvass-training', 'Deep Canvass Political Persuasion Training', 'Voter Mobilization',
   'Saturday, September 12, 2026', '10:00 AM – 1:00 PM',
   '2026-09-12T10:00:00-07:00', '2026-09-12T13:00:00-07:00',
   'Online / Zoom Workshop', 'Sacramento County / Virtual',
   'Learn how to engage conflicted voters in meaningful 1-on-1 dialogue to counter disinformation and build voter turnout in swing districts.',
   'https://www.mobilize.us/wethefighters/', false, 50),
  ('fall-postcards-drive', 'Postcard Writing & Voter Outreach Blitz', 'Voter Mobilization',
   'Sunday, September 20, 2026', '2:00 PM – 4:00 PM',
   '2026-09-20T14:00:00-07:00', '2026-09-20T16:00:00-07:00',
   'Fair Oaks Community Clubhouse', '7997 California Ave, Fair Oaks, CA 95628',
   'Writing handwritten postcards to registered voters in California swing districts encouraging turnout. Postcards, addresses, and scripts provided.',
   'mailto:contact@indivisiblefairoaks.org?subject=Postcard%20Blitz%20RSVP', false, 60)
ON CONFLICT (slug) DO NOTHING;

-- --------------------------------------------------------------- partners --
CREATE TABLE IF NOT EXISTS public.partners (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partners_sort_idx ON public.partners (sort_order);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public partners viewable" ON public.partners;
CREATE POLICY "Public partners viewable"
  ON public.partners
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.partners TO anon, authenticated;

INSERT INTO public.partners (slug, name, category, description, url, sort_order)
VALUES
  ('national-indivisible', 'National Indivisible Project', 'National Movement',
   'A grassroots movement of thousands of local chapters with a shared vision of a democracy by the people, of the people, and for all people.',
   'https://indivisible.org', 10),
  ('indivisible-ca-statestrong', 'Indivisible California StateStrong', 'Statewide Coalition',
   'Connecting dozens of local Indivisible chapters across California to coordinate legislative advocacy in Sacramento and champion state-level progressive policy.',
   'https://indivisibleca.org', 20),
  ('sister-district-sac', 'Sister District Sacramento', 'Electoral Partner',
   'Mobilizing volunteers to build lasting progressive power in state legislatures across the country by supporting critical swing-district candidates.',
   'https://sisterdistrict.com', 30),
  ('5calls', '5 Calls: Make Your Voice Heard', 'Civic Tech Partner',
   'The most effective, fast way for everyday citizens to call their elected officials about crucial democracy, healthcare, and civil rights bills.',
   'https://5calls.org', 40),
  ('lwv-sacramento', 'League of Women Voters Sacramento County', 'Voting Rights & Nonpartisan Guides',
   'Empowering voters and defending democracy through nonpartisan ballot analysis, candidate forums, and local high school voter registration drives.',
   'https://my.lwv.org/california/sacramento-county', 50),
  ('aclu-norcal', 'ACLU of Northern California', 'Civil Liberties & Legal Defense',
   'Guarding the constitutional rights of all Californians through strategic litigation, community education, and policy reform.',
   'https://www.aclunc.org', 60)
ON CONFLICT (slug) DO NOTHING;

-- -------------------------------------------------------- coalition_links --
CREATE TABLE IF NOT EXISTS public.coalition_links (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  badge TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coalition_links_sort_idx ON public.coalition_links (sort_order);
CREATE INDEX IF NOT EXISTS coalition_links_category_idx ON public.coalition_links (category);

ALTER TABLE public.coalition_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public coalition links viewable" ON public.coalition_links;
CREATE POLICY "Public coalition links viewable"
  ON public.coalition_links
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.coalition_links TO anon, authenticated;

INSERT INTO public.coalition_links (slug, name, category, url, description, badge, sort_order)
VALUES
  ('indivisible-national', 'Indivisible National', 'Movement Partners',
   'https://indivisible.org',
   'The national movement to elect progressive leaders and rebuild our democracy. Guides, toolkits, and national call campaigns.',
   'National Hub', 10),
  ('indivisible-ca', 'Indivisible California State Network', 'Movement Partners',
   'https://indivisibleca.org',
   'Coordinating Indivisible chapters across California for Sacramento legislative advocacy and statewide election protection.',
   NULL, 20),
  ('mobilize-directory', 'Mobilize.us Indivisible Directory', 'Movement Partners',
   'https://www.mobilize.us/indivisible/',
   'Find upcoming local meetings, rallies, text banks, and phone banks organized by Indivisible chapters across California.',
   NULL, 30),
  ('ca-voter-reg', 'California Online Voter Registration', 'Voter Resources',
   'https://registertovote.ca.gov',
   'Register to vote online or update your address and party registration with the California Secretary of State.',
   'Official SOS', 40),
  ('ballottrax', 'Where''s My Ballot? (BallotTrax)', 'Voter Resources',
   'https://wheresmyballot.sos.ca.gov',
   'Track when your vote-by-mail ballot is printed, mailed, received, and counted by your county elections office.',
   NULL, 50),
  ('sac-elections', 'Sacramento County Elections Division', 'Voter Resources',
   'https://elections.saccounty.gov',
   'Official county portal for ballot drop-off locations, Vote Center hours, and official election results.',
   NULL, 60),
  ('lwv-sacramento', 'League of Women Voters of Sacramento County', 'Civic Education',
   'https://www.lwvsacramento.org',
   'Trusted, nonpartisan in-depth analysis of statewide ballot propositions and local candidate debates.',
   NULL, 70),
  ('aclu-norcal', 'ACLU of Northern California', 'Civic Education',
   'https://www.aclunc.org',
   'Defending civil liberties, constitutional rights, and public protest protections across Northern California.',
   NULL, 80),
  ('actblue-portal', 'ActBlue Contribution Portal', 'Support',
   'https://secure.actblue.com/donate/indivisiblefoc1432155925',
   'Direct contribution portal to support Indivisible Fair Oaks-Carmichael grassroots organizing.',
   'Support Our Work', 90)
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------- newsletters --
CREATE TABLE IF NOT EXISTS public.newsletters (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date_label TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  topics TEXT[] NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS newsletters_sort_idx ON public.newsletters (sort_order);

ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public newsletters viewable" ON public.newsletters;
CREATE POLICY "Public newsletters viewable"
  ON public.newsletters
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.newsletters TO anon, authenticated;

INSERT INTO public.newsletters (slug, title, date_label, description, topics, sort_order, published_at)
VALUES
  ('summer-action-bulletin-2026', 'Indivisible Fair Oaks-Carmichael Summer Action Bulletin', 'July 2026',
   'Summer organizing priorities: preparing for upcoming elections, choir street demonstrations at Fair Oaks & Manzanita, local food bank drives, and phone-banking schedules.',
   ARRAY['Election Defense', 'Choir Actions', 'Food Drive', 'Mobilize Events'], 10, '2026-07-01T00:00:00Z'),
  ('midyear-review-2026', 'Mid-Year Grassroots Review & Legislative Round-up', 'June 2026',
   'Review of California state legislative priorities, local city council actions, deep canvass voter persuasion results, and upcoming coalition rallies in Citrus Heights.',
   ARRAY['California Bills', 'Deep Canvass', 'Sunrise Solidarity', 'Voter Outreach'], 20, '2026-06-01T00:00:00Z'),
  ('spring-mobilization-2026', 'Spring Mobilization & Resistance Choir Launch', 'May 2026',
   'Announcing the official schedule for the Carmichael Resistance Choir, spring town hall debriefs, and youth voter pre-registration drives across Sacramento County.',
   ARRAY['Resistance Choir', 'Youth Pre-Registration', 'Town Halls'], 30, '2026-05-01T00:00:00Z'),
  ('spring-newsletter-2026', 'Defending Democratic Norms: Spring Chapter Newsletter', 'April 2026',
   'National Indivisible strategy updates, local community resistance workshops, and mutual aid efforts for Fair Oaks and Carmichael neighborhood families.',
   ARRAY['National Strategy', 'Mutual Aid', 'Community Care'], 40, '2026-04-01T00:00:00Z')
ON CONFLICT (slug) DO NOTHING;
