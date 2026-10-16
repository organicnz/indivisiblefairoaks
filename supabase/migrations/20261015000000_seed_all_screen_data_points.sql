-- Migration: 20261015000000_seed_all_screen_data_points.sql
-- Seeds all remaining data points across Events, News, Partners, FAQs, Gallery,
-- Donate Calculator, Home, About, Footer, Privacy Policy, and Terms & Conditions.
-- Zero hardcoded text: all copy is stored in Supabase DB and managed via Visual Editor / Edge Functions.

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  -- Events Page
  ('events.spotlight.eyebrow', 'events', 'Events Spotlight Eyebrow', 'Ongoing Community Action', 'text'),
  ('events.spotlight.title', 'events', 'Events Spotlight Title', 'Carmichael Resistance Choir: Street Corner Singing Protest', 'text'),
  ('events.spotlight.schedule', 'events', 'Events Spotlight Schedule', 'Every Saturday Afternoon • 3:00 PM – 4:30 PM • Corner of Fair Oaks Blvd & Manzanita Ave, Carmichael, CA', 'text'),
  ('events.spotlight.desc', 'events', 'Events Spotlight Description', 'We sing our protest to afternoon traffic and community patrons. Bring your signs, lawn chairs, and voices to stand up for democracy! No singing experience required — all community members are warmly welcomed.', 'text'),
  ('events.spotlight.btn_songbook', 'events', 'Events Spotlight Songbook Button', 'Explore Songbook', 'text'),
  ('events.spotlight.btn_protest', 'events', 'Events Spotlight Join Button', 'Join Next Protest', 'text'),
  ('events.trainings.title', 'events', 'Events Trainings Section Title', 'Trainings & Action Labs', 'text'),
  ('events.trainings.t1_title', 'events', 'Events Training 1 Title', 'Deep Canvass Political Persuasion Training', 'text'),
  ('events.trainings.t1_desc', 'events', 'Events Training 1 Description', 'Learn the proven art of deep canvassing: connecting with conflicted voters through empathetic listening and shared values to build durable election support.', 'text'),
  ('events.trainings.t1_badge', 'events', 'Events Training 1 Badge', 'We The Fighters / Organizing to Fight Oligarchy', 'text'),
  ('events.trainings.t2_title', 'events', 'Events Training 2 Title', 'Know Your Rights Civic Workshop', 'text'),
  ('events.trainings.t2_desc', 'events', 'Events Training 2 Description', 'Everyone has fundamental constitutional rights under U.S. law. Learn what your rights are, how to safely exercise them in public, and what to do if your rights are violated.', 'text'),
  ('events.trainings.t2_link', 'events', 'Events Training 2 Link Text', 'ACLU Know Your Rights Guide', 'text'),
  ('events.nonviolence.title', 'events', 'Events Nonviolence Banner Title', 'Our Nonviolent Commitment:', 'text'),
  ('events.nonviolence.desc', 'events', 'Events Nonviolence Banner Description', 'All Indivisible Fair Oaks-Carmichael events are strictly nonviolent. We expect all attendees to act lawfully and de-escalate any potential confrontation with counter-protesters. No weapons are permitted at any event.', 'text'),

  -- News Page
  ('news.subscribe.badge', 'news', 'News Subscribe Badge', 'Direct To Your Inbox', 'text'),
  ('news.subscribe.btn', 'news', 'News Subscribe Button Text', 'Email to Subscribe', 'text'),
  ('news.archive.title', 'news', 'News Archive Section Title', 'Past Bulletins & Archives', 'text'),
  ('news.national.title', 'news', 'News National Wire Title', 'National Indivisible Resources', 'text'),
  ('news.national.desc', 'news', 'News National Wire Description', 'Indivisible Fair Oaks-Carmichael is one of thousands of grassroots groups nationwide following the proven guide created by former congressional staffers. For nationwide campaigns, toolkits, and legislative tracking, visit the national network at indivisible.org.', 'text'),

  -- Partners Page
  ('partners.card.visit_link', 'partners', 'Partners Card Visit Link Text', 'Visit Partner Website', 'text'),
  ('partners.cta.button', 'partners', 'Partners CTA Button Text', 'Connect With Our Coalition Team', 'text'),

  -- FAQs Page
  ('faqs.contact_button', 'faqs', 'FAQs Direct Contact Button', 'Contact Us Directly', 'text'),

  -- Gallery Page
  ('gallery.metrics.m1_stat', 'gallery', 'Gallery Metric 1 Stat', 'No Kings', 'text'),
  ('gallery.metrics.m1_label', 'gallery', 'Gallery Metric 1 Label', 'Sacramento Actions', 'text'),
  ('gallery.metrics.m2_stat', 'gallery', 'Gallery Metric 2 Stat', 'NorCal Resist', 'text'),
  ('gallery.metrics.m2_label', 'gallery', 'Gallery Metric 2 Label', 'Direct Solidarity', 'text'),
  ('gallery.metrics.m3_stat', 'gallery', 'Gallery Metric 3 Stat', 'Witty Signs', 'text'),
  ('gallery.metrics.m3_label', 'gallery', 'Gallery Metric 3 Label', 'Grassroots Humor', 'text'),
  ('gallery.metrics.m4_stat', 'gallery', 'Gallery Metric 4 Stat', '0 Politicians', 'text'),
  ('gallery.metrics.m4_label', 'gallery', 'Gallery Metric 4 Label', '100% People Power', 'text'),
  ('gallery.video.badge_top', 'gallery', 'Gallery Video Badge Top', 'Featured Video Archive', 'text'),
  ('gallery.video.title', 'gallery', 'Gallery Video Title', 'No Kings in America: The Movement in Motion', 'text'),
  ('gallery.video.desc', 'gallery', 'Gallery Video Description', 'Watch official grassroots mobilization footage and documentary highlights from our Sacramento County actions defending constitutional democracy.', 'text'),
  ('gallery.video.platform_tag', 'gallery', 'Gallery Video Platform Tag', 'Archived from Original Platform', 'text'),
  ('gallery.video.coalition_badge', 'gallery', 'Gallery Video Coalition Badge', 'Indivisible National & Local Coalition', 'text'),
  ('gallery.video.subheading', 'gallery', 'Gallery Video Subheading', 'No Kings 3 Nationwide Action', 'text'),
  ('gallery.video.action_desc', 'gallery', 'Gallery Video Action Description', 'Highlights from the nationwide peaceful rallies rejecting authoritarian impunity and defending the rule of law. From Sacramento to communities across the country, thousands gathered with signs, chants, and peaceful resolve.', 'text'),
  ('gallery.video.btn_rallies', 'gallery', 'Gallery Video Rallies Button', 'Upcoming Rallies', 'text'),
  ('gallery.video.btn_choir', 'gallery', 'Gallery Video Choir Button', 'Choir Anthems', 'text'),
  ('gallery.cta.title', 'gallery', 'Gallery CTA Title', 'Have Sacramento Resistance Pics, Unity Shots, or Funny Signs?', 'text'),
  ('gallery.cta.desc', 'gallery', 'Gallery CTA Description', 'Did you snap a brilliant, witty cardboard sign, an uplifting choir moment, or neighbors standing in solidarity? Strictly grassroots (zero politicians, zero corporate imagery) — send your photos to our media circle to be included!', 'text'),
  ('gallery.cta.button', 'gallery', 'Gallery CTA Button', 'Submit Grassroots Photos', 'text'),

  -- Donate Page
  ('donate.calc.eyebrow', 'donate', 'Donate Calculator Eyebrow', 'Interactive Grassroots Calculator', 'text'),
  ('donate.calc.title', 'donate', 'Donate Calculator Title', 'Choose Your Contribution', 'text'),
  ('donate.calc.subhead', 'donate', 'Donate Calculator Subhead', 'See the concrete civic impact of your grassroots investment before you give.', 'text'),

  -- Home Page
  ('home.hero.btn_actions', 'home', 'Home Hero Actions Button', 'Upcoming Actions', 'text'),
  ('home.hero.btn_support', 'home', 'Home Hero Support Button', 'Support Our Chapter', 'text'),
  ('home.hero.btn_choir', 'home', 'Home Hero Choir Button', 'Resistance Choir', 'text'),
  ('home.gathering.badge', 'home', 'Home Gathering Badge', 'Next Community Gathering', 'text'),
  ('home.gathering.btn_cal', 'home', 'Home Gathering Add Calendar Button', '+ Add to Calendar', 'text'),
  ('home.gathering.btn_rsvp', 'home', 'Home Gathering RSVP Button', 'RSVP via Mobilize', 'text'),
  ('home.voter.view_all', 'home', 'Home Voter View All Guides', 'View All 7 Voter Guides', 'text'),
  ('home.voter.card1_btn', 'home', 'Home Voter Card 1 Button', 'Access Guide & Directory', 'text'),
  ('home.voter.card2_btn', 'home', 'Home Voter Card 2 Button', 'Youth Voting Guide', 'text'),
  ('home.voter.card3_btn', 'home', 'Home Voter Card 3 Button', 'Read Rights Overview', 'text'),
  ('home.gallery.eyebrow', 'home', 'Home Gallery Eyebrow', 'Photojournalism In Action', 'text'),
  ('home.gallery.headline', 'home', 'Home Gallery Headline', 'Moments of Peaceful Resistance', 'text'),
  ('home.gallery.intro', 'home', 'Home Gallery Intro', 'Snapshots of our neighbors gathering, singing, holding signs, and speaking truth to power across Sacramento County. Strictly 100% grassroots — zero politicians, zero corporate branding.', 'text'),
  ('home.gallery.btn_view_all', 'home', 'Home Gallery View All Button', 'Explore Full Gallery Archive', 'text'),
  ('home.cta.btn_donate', 'home', 'Home CTA Donate Button', 'Donate via ActBlue', 'text'),
  ('home.cta.btn_subscribe', 'home', 'Home CTA Subscribe Button', 'Join Mailing List', 'text'),

  -- About Page
  ('about.join.btn_events', 'about', 'About Join Events Button', 'See Upcoming Events', 'text'),
  ('about.join.btn_contact', 'about', 'About Join Contact Button', 'Contact Us', 'text'),

  -- Footer
  ('footer.col_explore', 'footer', 'Footer Explore Column Header', 'Explore', 'text'),
  ('footer.col_involved', 'footer', 'Footer Get Involved Header', 'Get Involved', 'text'),
  ('footer.col_connect', 'footer', 'Footer Connect With Us Header', 'Connect With Us', 'text'),
  ('footer.label_inquiries', 'footer', 'Footer General Inquiries Label', 'General Inquiries:', 'text'),
  ('footer.label_mailing', 'footer', 'Footer Mailing List Label', 'Mailing List:', 'text'),

  -- Privacy Page
  ('privacy.hero.title', 'privacy', 'Privacy Policy Title', 'Privacy Policy', 'text'),
  ('privacy.body.intro', 'privacy', 'Privacy Policy Intro', 'At Indivisible Fair Oaks-Carmichael, we recognise your right to confidentiality and are committed to protecting your privacy. Our website address is: https://indivisiblefairoaks.org.', 'text'),
  ('privacy.collect.title', 'privacy', 'Privacy Collect Title', 'What data we collect', 'text'),
  ('privacy.collect.body', 'privacy', 'Privacy Collect Body', 'When visitors leave comments or place orders, we collect the data provided in the forms, and also the visitor''s IP address and browser user agent string to help spam detection.', 'text'),
  ('privacy.cookies.title', 'privacy', 'Privacy Cookies Title', 'Cookies', 'text'),
  ('privacy.cookies.body1', 'privacy', 'Privacy Cookies Body 1', 'If you leave a comment on our site you may opt-in to saving your name, email address and website in cookies. These are for your convenience so that you do not have to fill in your details again.', 'text'),
  ('privacy.cookies.body2', 'privacy', 'Privacy Cookies Body 2', 'When you log in, we will also set up several cookies to save your login information and your screen display choices. Login cookies last for two days, and screen options cookies last for a year.', 'text'),
  ('privacy.embedded.title', 'privacy', 'Privacy Embedded Content Title', 'Embedded content', 'text'),
  ('privacy.embedded.body', 'privacy', 'Privacy Embedded Content Body', 'Articles on this site may include embedded content (e.g. videos, images, articles, etc.). Embedded content from other websites behaves in the exact same way as if the visitor has visited the other website.', 'text'),
  ('privacy.retain.title', 'privacy', 'Privacy Retention Title', 'How long we retain your data', 'text'),
  ('privacy.retain.body', 'privacy', 'Privacy Retention Body', 'If you leave a comment, the comment and its metadata are retained indefinitely. For users that register on our website, we also store the personal information they provide in their user profile.', 'text'),
  ('privacy.security.title', 'privacy', 'Privacy Security Title', 'Security', 'text'),
  ('privacy.security.body', 'privacy', 'Privacy Security Body', 'We use a secure server for transactions to ensure absolute confidentiality. Under no circumstances is your information used for anything other than our grassroots organizing and communications.', 'text'),

  -- Terms Page
  ('terms.hero.title', 'terms', 'Terms and Conditions Title', 'Terms and Conditions', 'text'),
  ('terms.last_updated', 'terms', 'Terms Last Updated', 'Last updated: October 2026', 'text'),
  ('terms.intro', 'terms', 'Terms Intro', 'These terms and conditions govern the relationship between you and Indivisible Fair Oaks-Carmichael. Including the use of this website, any contributions or interactions you make with us and our community programs. By accessing, browsing or using this site, you acknowledge and agree to these terms and conditions.', 'text'),
  ('terms.mission.title', 'terms', 'Terms Grassroots Mission Title', 'Grassroots Mission & Non-Violence', 'text'),
  ('terms.mission.body', 'terms', 'Terms Grassroots Mission Body', 'Indivisible Fair Oaks-Carmichael is a grassroots, non-partisan volunteer community organization. All participants and website visitors agree to uphold peaceful, disciplined nonviolent community norms.', 'text'),
  ('terms.disclaimer.title', 'terms', 'Terms Contribution Disclaimer Title', 'Contribution & Content Disclaimer', 'text'),
  ('terms.disclaimer.body', 'terms', 'Terms Contribution Disclaimer Body', 'Contributions made to our chapter via ActBlue are non-tax-deductible gifts dedicated to local grassroots organizing, venue rentals, and civil advocacy. Content provided on this site is for educational and civic mobilization purposes.', 'text')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = now();
