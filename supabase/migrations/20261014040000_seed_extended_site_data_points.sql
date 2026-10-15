-- 20261014040000_seed_extended_site_data_points.sql
-- Seed extended comprehensive site data points for events, news, faqs, partners, links, gallery, footer, and home sections.
-- All values are stored in public.data_points as the authoritative single source of truth.

INSERT INTO public.data_points (key, value, group_name, label)
VALUES
  -- ── 1. Home Section Extended ────────────────────────────────────────────────
  ('home.choir.eyebrow', 'Carmichael Resistance Choir', 'home', 'Home Choir Eyebrow'),
  ('home.choir.headline', 'Every good protest movement needs music.', 'home', 'Home Choir Headline'),
  ('home.choir.intro', 'Music lifts us up and has sustained justice movements throughout history. We gather to weave our voices together in chants and songs of resistance, building vibrant community while marching forward.', 'home', 'Home Choir Intro'),
  ('home.choir.all_voices', 'All Voices Welcome', 'home', 'Home Choir All Voices Title'),
  ('home.choir.all_voices_sub', 'No auditions, no fees. Everyone can sing.', 'home', 'Home Choir All Voices Subtitle'),
  ('home.choir.rehearsal', 'Rehearsal Schedule', 'home', 'Home Choir Rehearsal Schedule Title'),
  ('home.choir.rehearsal_sub', 'Every other Wednesday, 6:30 – 8:00 PM.', 'home', 'Home Choir Rehearsal Subtitle'),
  ('home.choir.quote', 'We will sing our protest to the afternoon rush hour and community businesses. Bring your signs, chairs, and voices!', 'home', 'Home Choir Callout Quote'),
  ('home.voter.eyebrow', 'Empowering Every Voter', 'home', 'Home Voter Hub Eyebrow'),
  ('home.voter.headline', 'Voter Education & Rights Hub', 'home', 'Home Voter Hub Headline'),
  ('home.voter.card1_title', 'Sacramento County Elected Officials', 'home', 'Home Voter Card 1 Title'),
  ('home.voter.card1_desc', 'Direct contact information, phone numbers, and offices for local, state, and federal representatives serving our district.', 'home', 'Home Voter Card 1 Description'),
  ('home.voter.card2_title', 'Pre-Registration at 16', 'home', 'Home Voter Card 2 Title'),
  ('home.voter.card2_desc', 'California youth age 16 and 17 can pre-register now so they are automatically registered to cast their ballot the day they turn 18.', 'home', 'Home Voter Card 2 Description'),
  ('home.voter.card3_title', 'Rights Restoration & Unhoused Voting', 'home', 'Home Voter Card 3 Title'),
  ('home.voter.card3_desc', 'Homeless is not voteless. Learn about voting rights restoration for formerly incarcerated Californians and unhoused residents.', 'home', 'Home Voter Card 3 Description'),
  ('home.nonviolence.headline', 'Our Core Commitment: Disciplined Non-Violent Action', 'home', 'Home Nonviolence Headline'),
  ('home.nonviolence.desc', 'A core principle behind all Indivisible events is an unwavering commitment to nonviolent action. We expect all participants to act lawfully, avoid civil disobedience unless specifically planned and coordinated, de-escalate any potential confrontation with those who disagree with our values, and maintain peaceful solidarity.', 'home', 'Home Nonviolence Policy Description'),
  ('home.cta.eyebrow', 'Grassroots Power Runs On Grassroots Support', 'home', 'Home Footer CTA Eyebrow'),
  ('home.cta.headline', 'Fuel Our Local Organizing', 'home', 'Home Footer CTA Headline'),
  ('home.cta.desc', 'Every dollar contributed to our chapter directly supports community meeting spaces, protest banners, sound equipment for the Resistance Choir, voter registration printing, and neighborhood outreach.', 'home', 'Home Footer CTA Description'),

  -- ── 2. Events Page ─────────────────────────────────────────────────────────
  ('events.hero.eyebrow', 'Community Actions & Calendar', 'events', 'Events Hero Eyebrow'),
  ('events.hero.headline', 'Upcoming Events & Mobilizations', 'events', 'Events Hero Headline'),
  ('events.hero.intro', 'Find out when and where our chapter is gathering. All community members committed to peaceful, democratic activism are warmly welcome.', 'events', 'Events Hero Intro'),

  -- ── 3. News Page ───────────────────────────────────────────────────────────
  ('news.hero.eyebrow', 'Chapter Bulletins & Insights', 'news', 'News Hero Eyebrow'),
  ('news.hero.headline', 'Newsletters & Chapter Updates', 'news', 'News Hero Headline'),
  ('news.hero.intro', 'Stay up to date with our grassroots organizing, local legislative actions, and community resistance across Fair Oaks, Carmichael, and Sacramento County.', 'news', 'News Hero Intro'),
  ('news.subscribe.headline', 'Subscribe to Action Alerts', 'news', 'News Subscribe Headline'),
  ('news.subscribe.intro', 'Receive notifications for upcoming meetings, emergency rapid response rallies, choir rehearsal locations, and legislative call-to-action alerts.', 'news', 'News Subscribe Description'),

  -- ── 4. FAQs Page ───────────────────────────────────────────────────────────
  ('faqs.hero.eyebrow', 'Frequently Asked Questions', 'faqs', 'FAQs Hero Eyebrow'),
  ('faqs.hero.headline', 'Frequently Asked Questions', 'faqs', 'FAQs Hero Headline'),
  ('faqs.hero.intro', 'Have questions about attending a meeting, singing with the choir, or getting involved? Find quick answers below.', 'faqs', 'FAQs Hero Intro'),
  ('faqs.still_have_questions', 'Still have a question?', 'faqs', 'FAQs Bottom Card Headline'),
  ('faqs.still_have_questions_sub', 'Our volunteer organizing committee is always here to help you get connected.', 'faqs', 'FAQs Bottom Card Subtitle'),

  -- ── 5. Partners Page ───────────────────────────────────────────────────────
  ('partners.hero.eyebrow', 'Grassroots Coalition Network', 'partners', 'Partners Hero Eyebrow'),
  ('partners.hero.headline', 'Our Coalition Partners & Allies', 'partners', 'Partners Hero Headline'),
  ('partners.hero.intro', 'We believe democracy is a team sport. Indivisible Fair Oaks-Carmichael works in close partnership with national organizations, California coalitions, and Sacramento community advocates.', 'partners', 'Partners Hero Intro'),
  ('partners.cta.headline', 'Looking to Partner with Our Chapter?', 'partners', 'Partners CTA Headline'),
  ('partners.cta.intro', 'If your organization shares our dedication to civil rights, progressive governance, and democratic defense, we’d love to collaborate on upcoming actions.', 'partners', 'Partners CTA Intro'),

  -- ── 6. Links Page ──────────────────────────────────────────────────────────
  ('links.hero.eyebrow', 'Civic Directory', 'links', 'Links Hero Eyebrow'),
  ('links.hero.headline', 'Coalition & Action Links', 'links', 'Links Hero Headline'),
  ('links.hero.intro', 'Essential websites, nonpartisan voter tools, grassroots allies, and democracy defense resources vetted by our chapter.', 'links', 'Links Hero Intro'),

  -- ── 7. Gallery Page ────────────────────────────────────────────────────────
  ('gallery.hero.eyebrow', 'Photojournalism In Action • Moments of Peaceful Resistance', 'gallery', 'Gallery Hero Eyebrow'),
  ('gallery.hero.headline', 'Democracy In Full View', 'gallery', 'Gallery Hero Headline'),
  ('gallery.hero.intro', 'Snapshots of our neighbors gathering, singing, holding signs, and speaking truth to power across Sacramento County. Curated from our legacy site archives, Sacramento No Kings mobilizations, NorCal Resist community defense, Carmichael Resistance Choir, and witty grassroots cardboard art. Strictly 100% grassroots — zero politicians, zero corporate branding.', 'gallery', 'Gallery Hero Intro'),

  -- ── 8. Footer Section ──────────────────────────────────────────────────────
  ('footer.tagline', 'A grassroots movement dedicated to defending democracy, resisting authoritarianism, electing progressive leaders, and taking direct non-violent action for our community.', 'footer', 'Footer Brand Tagline'),
  ('footer.meeting_notice', 'Meetings held monthly in Carmichael, CA. Bring a non-perishable food item for local food banks!', 'footer', 'Footer Meeting Notice'),
  ('footer.inquiry_intro', 'Have a question or want to get involved with our local organizing team?', 'footer', 'Footer Inquiries Intro'),
  ('footer.copyright_disclaimer', 'All rights reserved. Grassroots volunteer organization.', 'footer', 'Footer Copyright Disclaimer')
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  group_name = EXCLUDED.group_name,
  label = EXCLUDED.label,
  updated_at = NOW();
