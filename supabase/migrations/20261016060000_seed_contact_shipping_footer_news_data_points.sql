-- Migration: 20261016060000_seed_contact_shipping_footer_news_data_points.sql
-- Description: Comprehensive DataPoints for contact form, shipping bullets, footer navigation, news archive, and account security

INSERT INTO public.data_points (key, value, group_name, label) VALUES
  -- Contact Page Form & Channels
  ('contact.status.success_msg', 'Message sent successfully! Our organizing team will be in touch soon.', 'contact', 'Contact form success alert text'),
  ('contact.status.copy_sent_prefix', 'A confirmation copy has been sent to', 'contact', 'Contact confirmation email notice prefix'),
  ('contact.status.partial_copy_msg', 'Message sent to our organizing team! We will be in touch soon.', 'contact', 'Partial copy delivery warning headline'),
  ('contact.status.partial_copy_detail', 'The copy to your inbox could not be delivered — but your message reached us and we will reply directly.', 'contact', 'Partial copy delivery warning body'),
  ('contact.status.partial_notify_msg', 'Message saved, but notification email failed. For an immediate response, please email us directly at', 'contact', 'Partial notify failure text'),
  ('contact.form.name_label', 'Full Name', 'contact', 'Contact form full name input label'),
  ('contact.form.name_placeholder', 'First and last name', 'contact', 'Contact form full name input placeholder'),
  ('contact.form.email_label', 'Email Address', 'contact', 'Contact form email input label'),
  ('contact.form.email_placeholder', 'you@domain.org', 'contact', 'Contact form email input placeholder'),
  ('contact.form.message_label', 'Message', 'contact', 'Contact form message textarea label'),
  ('contact.form.message_placeholder', 'Tell us how you would like to get involved, ask a question about our chapter, or join the Resistance Choir...', 'contact', 'Contact form message textarea placeholder'),
  ('contact.form.prefs_legend', 'Email preferences', 'contact', 'Contact form email preferences fieldset legend'),
  ('contact.form.send_copy_label', 'Send me a copy of this message for my records', 'contact', 'Contact form send copy checkbox label'),
  ('contact.form.consent_label', 'Yes, add me to chapter email about actions, meetings and volunteer opportunities. Every message carries an unsubscribe link.', 'contact', 'Contact form marketing consent checkbox label'),
  ('contact.form.privacy_notice', 'We never sell or share your address. Leaving the box unticked keeps you out of campaign emails — we will still reply to this message.', 'contact', 'Contact form privacy notice below consent checkbox'),
  ('contact.form.submit_btn', 'Send Message', 'contact', 'Contact form submit button text'),
  ('contact.form.submitting_btn', 'Sending Message...', 'contact', 'Contact form submitting state text'),
  ('contact.footer.channels_title', 'Direct Email Channels', 'contact', 'Direct email channels footer card headline'),
  ('contact.footer.channels_general_label', 'General:', 'contact', 'Direct email general label'),
  ('contact.footer.channels_newsletter_label', 'Newsletter:', 'contact', 'Direct email newsletter label'),
  ('contact.footer.gatherings_title', 'Monthly Gatherings', 'contact', 'Monthly gatherings footer card headline'),
  ('contact.footer.gatherings_schedule', 'First Tuesday of the month (6:30 – 8:00 PM)', 'contact', 'Monthly gatherings meeting schedule'),
  ('contact.footer.gatherings_location', 'St. Michael''s Episcopal Church, Carmichael, CA', 'contact', 'Monthly gatherings meeting location'),

  -- Shipping & Returns Page Bullets & Details
  ('shipping.bullet.pickup', 'Direct community pickup & delivery for local actions', 'shipping', 'Shipping policy bullet item 1'),
  ('shipping.bullet.hub', 'Dispatched from Indivisible Fair Oaks Distribution Hub', 'shipping', 'Shipping policy bullet item 2'),
  ('shipping.bullet.delivery_times', 'Indicative delivery times provided at order', 'shipping', 'Shipping policy bullet item 3'),
  ('shipping.bullet.secure_packaging', 'Civic materials packaged securely', 'shipping', 'Shipping policy bullet item 4'),
  ('shipping.returns.bullet_30days', 'Replacement requests within 30 days of receipt', 'shipping', 'Returns policy bullet item 1'),
  ('shipping.returns.bullet_posts', 'Direct support for broken or damaged signposts', 'shipping', 'Returns policy bullet item 2'),
  ('shipping.returns.bullet_contact', 'Contact us before returning any campaign items', 'shipping', 'Returns policy bullet item 3'),
  ('shipping.returns.bullet_support', '100% committed to community mobilization support', 'shipping', 'Returns policy bullet item 4'),

  -- Account Password Reset
  ('account.password.new_label', 'New Password', 'account', 'New password form label'),
  ('account.password.new_placeholder', 'Min. 8 characters', 'account', 'New password input placeholder'),
  ('account.password.confirm_label', 'Confirm Password', 'account', 'Confirm password form label'),
  ('account.password.confirm_placeholder', 'Repeat your password', 'account', 'Confirm password input placeholder'),
  ('account.password.match_success', '✓ Passwords match', 'account', 'Password match indicator success text'),
  ('account.password.match_error', '✗ Passwords do not match', 'account', 'Password match indicator error text'),

  -- Cart
  ('cart.btn.processing', 'Processing...', 'cart', 'Cart checkout loading button label'),
  ('cart.summary.shipping_view_rates', 'View Rates (From $8.00 or Free Pickup)', 'cart', 'Cart shipping view rates link label'),

  -- News & Bulletins
  ('news.search.placeholder', 'Search bulletins, topics, or insights...', 'news', 'News search bar input placeholder'),
  ('news.topic.all', 'All Topics', 'news', 'News all topics filter chip'),
  ('news.admin.add_bulletin', 'Add Bulletin', 'news', 'Admin button to add new civic bulletin'),
  ('news.empty.title', 'No chapter bulletins match your criteria', 'news', 'News empty search result title'),
  ('news.empty.desc', 'No chapter bulletins match your criteria. Try choosing "All Topics" or searching for another civic keyword.', 'news', 'News empty search result description'),
  ('news.read_bulletin', 'Read Bulletin', 'news', 'News bulletin card action button'),

  -- Site Footer
  ('footer.nav.about', 'About Us & Mission', 'footer', 'Footer navigation link to about page'),
  ('footer.nav.events', 'Upcoming Events & Actions', 'footer', 'Footer navigation link to events page'),
  ('footer.nav.choir', 'Carmichael Resistance Choir', 'footer', 'Footer navigation link to choir page'),
  ('footer.nav.voter', 'Voter Information & Guides', 'footer', 'Footer navigation link to voter info page'),
  ('footer.nav.news', 'Newsletters & Bulletins', 'footer', 'Footer navigation link to news page'),
  ('footer.nav.links', 'Coalition & Action Links', 'footer', 'Footer navigation link to links page'),
  ('footer.nav.mobilize', 'Mobilize.us Events', 'footer', 'Footer navigation link to mobilize.us external directory'),
  ('footer.nav.sing', 'Sing in the Choir', 'footer', 'Footer action link to join choir'),
  ('footer.nav.subscribe', 'Subscribe to Newsletter', 'footer', 'Footer action link to subscribe to newsletter'),
  ('footer.nav.donate', 'Donate via ActBlue', 'footer', 'Footer action link to ActBlue contribution portal'),
  ('footer.label.newsletter', 'Newsletter Subscriptions:', 'footer', 'Footer label for newsletter contact channel'),
  ('footer.copyright_suffix', 'Indivisible Fair Oaks-Carmichael. All rights reserved.', 'footer', 'Footer copyright suffix statement')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    label = EXCLUDED.label,
    updated_at = timezone('utc'::text, now());
