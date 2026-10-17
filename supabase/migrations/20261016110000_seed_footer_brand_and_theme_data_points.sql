-- Seed additional footer brand, link, and theme data points into public.data_points
INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('footer.brand.indivisible', 'footer', 'Footer Brand Movement Name', 'Indivisible', 'text'),
  ('footer.brand.chapter', 'footer', 'Footer Brand Chapter Name', 'Fair Oaks & Carmichael', 'text'),
  ('footer.email_contact', 'footer', 'Footer General Inquiries Email Address', 'contact@indivisiblefairoaks.org', 'text'),
  ('footer.email_subscribe', 'footer', 'Footer Newsletter Subscription Email Address', 'subscribe@indivisiblefairoaks.org', 'text'),
  ('footer.bottom.about', 'footer', 'Footer Bottom Bar About Link', 'About', 'text'),
  ('footer.bottom.contact', 'footer', 'Footer Bottom Bar Contact Link', 'Contact', 'text'),
  ('footer.bottom.actblue', 'footer', 'Footer Bottom Bar ActBlue Link', 'ActBlue', 'text'),
  ('footer.bottom.organizer', 'footer', 'Footer Bottom Bar Organizer Access Link', 'Organizer Access', 'text'),
  ('header.theme.mode_system', 'header', 'Theme Mode System Label', 'System', 'text'),
  ('header.theme.mode_light', 'header', 'Theme Mode Light Label', 'Light', 'text'),
  ('header.theme.mode_dark', 'header', 'Theme Mode Dark Label', 'Dark', 'text')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  updated_at = NOW();
