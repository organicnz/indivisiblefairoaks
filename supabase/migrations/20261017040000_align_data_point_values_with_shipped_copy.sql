-- Align seeded values with the copy the components actually ship.
--
-- A wired component's fallback literal and its seeded value must agree: SSR
-- output has to be identical whether or not the row is reachable, and from the
-- moment a migration applies it is the database value every reader sees. Two
-- kinds of drift accumulated:
--
--   * Labels deliberately kept for test parity and accessibility (ab8b0d6,
--     "Reset conversation"; 3cb5c5c, the choir custom-stream title) whose
--     seeds still carried earlier wording.
--   * Seed values written independently of the components that later render
--     them — the product sidebar CTA, cart summary labels, the voter guides,
--     the representative-finder labels, WALL-E placeholders, and the account
--     and choir page microcopy.
--
-- The shipped literal is canonical; the seed follows it. Applying this file
-- therefore changes no visible copy — it makes the database agree with what
-- the site already shows. Anyone who prefers the earlier seed wording can edit
-- it in the CMS afterwards, which is the point of the store.
--
-- Note on the WALL-E chip seed (20261017010000): it also carried an arity
-- defect — a four-column target list over five-value rows — so it failed on
-- apply. That file is repaired in place because it never reached the hosted
-- project; the values here are corrected by append, as usual.

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  -- Labels kept for test parity / accessibility.
  ('walle.action.clear', 'walle', 'WALL-E Reset Chat Button', 'Reset conversation', 'text'),
  ('walle.action.copy', 'walle', 'WALL-E Copy Response Button', 'Copy', 'text'),
  ('choir.player.status_custom', 'choir', 'Custom Web Stream Status', 'Custom Stream Broadcast', 'text'),

  -- WALL-E placeholders and launcher label.
  ('walle.input_placeholder', 'walle', 'WALL-E Input Placeholder', 'Ask WALL-E…', 'text'),
  ('walle.launcher_label', 'walle', 'WALL-E Launcher Accessible Label', 'Open WALL-E assistant', 'text'),

  -- Command palette and songbook search.
  ('palette.placeholder', 'palette', 'Command Palette Placeholder', 'Type a page, action, or civic topic…', 'text'),
  ('choir.songbook.search_placeholder', 'choir', 'Songbook Search Placeholder', 'Search songs by title, lyrics, or historical era…', 'text'),
  ('choir.player.custom_stream_placeholder', 'choir', 'Custom Stream URL Placeholder', 'Stream URL (https://...), Supabase S3 path (audio/song.mp3), or s3://...', 'text'),

  -- Representative finder input.
  ('voter.repfinder.input_placeholder', 'voter', 'Representative Finder ZIP Placeholder', 'Enter ZIP (e.g. 95628, 95608, 95662)', 'text'),

  -- Theme toggle tooltip suffix.
  ('header.theme.light', 'header', 'Theme Toggle Light Mode', 'Light', 'text'),
  ('header.theme.dark', 'header', 'Theme Toggle Dark Mode', 'Dark', 'text'),

  -- Contact status messages (the ⚠️ prefixes are what the form renders today).
  ('contact.status.partial_copy_msg', 'contact', 'Partial copy delivery warning headline', '⚠️ Message sent to our organizing team! We will be in touch soon.', 'text'),
  ('contact.status.partial_notify_msg', 'contact', 'Partial notify failure text', '⚠️ Message saved, but notification email failed. For an immediate response, please email us directly at', 'text'),

  -- Products.
  ('products.sidebar.help_desc', 'products', 'Products Sidebar Help Description', 'Can''t find what you''re looking for? Contact our gear experts for advice.', 'text'),
  ('products.card.details', 'products', 'Product Card Details Link', 'View Gear', 'text'),

  -- Choir schedule (the time and address lines are their own data points).
  ('choir.schedule.time', 'choir', 'Choir Schedule Time', 'Every Other Wednesday', 'text'),
  ('choir.schedule.location', 'choir', 'Choir Schedule Location', 'St. Michael''s Episcopal Church', 'text'),

  -- Cart.
  ('cart.empty.desc', 'cart', 'Cart Empty Description', 'Looks like you haven''t added any gear yet. Let''s get you equipped.', 'text'),
  ('cart.summary.shipping_label', 'cart', 'Shipping Estimate Label', 'Shipping', 'text'),
  ('cart.summary.shipping_note', 'cart', 'Shipping Note', 'Calculated at Checkout', 'text'),
  ('cart.btn.out_of_stock', 'cart', 'Add to Cart Out of Stock State', 'Out of stock', 'text'),

  -- Account.
  ('account.security.confirm_desc', 'account', 'Account Security Confirm Description', 'This account has two-factor authentication, so changing the password needs a verification code first. It is the same check that protects your account settings.', 'text'),
  ('account.password.new_desc', 'account', 'Account Set New Password Description', 'Choose a strong password for your account', 'text'),
  ('account.password.btn_update', 'account', 'Account Password Update Button', 'Set New Password', 'text'),
  ('account.btn.sign_out', 'account', 'Logout Button Default State', 'Sign Out', 'text'),

  -- Home.
  ('home.impact.districts_label', 'home', 'Impact Districts Label', 'Sacramento Region', 'text'),
  ('home.gallery.btn_view_all', 'home', 'Home Gallery View All Button', 'Explore Full Gallery', 'text'),

  -- News and events empty states (curly quotes match the JSX rendering).
  ('news.empty.desc', 'news', 'News empty search result description', 'No chapter bulletins match your criteria. Try choosing “All Topics” or searching for another civic keyword.', 'text'),
  ('news.read_bulletin', 'news', 'News bulletin card action button', 'Request Full Issue', 'text'),
  ('events.empty.desc', 'events', 'Events Empty State', 'No events found matching your criteria. Try selecting “All Actions” or clearing the search query.', 'text'),

  -- Voter information.
  ('voter.guides.subhead', 'voter', 'Voter Guides Subhead', 'Nonpartisan voting guides, ballot measure analyses, and local candidate recommendations prepared for Fair Oaks, Carmichael, and Sacramento County voters.', 'text'),
  ('voter.guide2.desc', 'voter', 'Voter Guide 2 Description', 'California youth age 16 and 17 can pre-register online now. When you turn 18, you will automatically be registered to cast your ballot in all elections. Spread the word in local high schools and community colleges!', 'text'),
  ('voter.guide3.desc', 'voter', 'Voter Guide 3 Description', 'In California, under Proposition 17, your right to vote is automatically restored immediately upon release from prison. If you are on parole, probation, or in county jail, you have the right to register and vote!', 'text'),
  ('voter.hotlines.headline', 'voter', 'Voter Hotlines Headline', 'Sacramento County Elections & Voter Hotlines', 'text'),

  -- Representative finder labels.
  ('voter.repfinder.headline', 'voter', 'Voter Rep Finder Headline', 'Know Your Representatives & Hold Them Accountable', 'text'),
  ('voter.repfinder.subhead', 'voter', 'Voter Rep Finder Subhead', 'Enter your local ZIP code to instantly find your federal, state, and county elected officials, complete with verified direct phone numbers and constituent advocacy scripts.', 'text'),
  ('voter.repfinder.btn_lookup', 'voter', 'Representative Finder Lookup Button', 'Find Officials', 'text'),
  ('voter.repfinder.call_script_heading', 'voter', 'Representative Finder Call Script Heading', 'Civic Action Phone Script', 'text'),
  ('voter.repfinder.tab_democracy', 'voter', 'Representative Finder Democracy Tab', 'Democracy', 'text'),
  ('voter.repfinder.tab_climate', 'voter', 'Representative Finder Climate Tab', 'Climate', 'text'),
  ('voter.repfinder.copied_btn', 'voter', 'Representative Finder Copied Confirmation', 'Copied!', 'text'),
  ('voter.repfinder.copy_btn', 'voter', 'Representative Finder Copy Button', 'Copy Script', 'text')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = now();
