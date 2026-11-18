-- Restore the public "Link Tree" naming requested in issue #164.
--
-- The broadsheet redesign replaced these strings with "Coalition & Action
-- Directory" without a recorded rename request. Keep the approved naming in
-- the CMS so the live page, footer, and navigation cannot drift from the
-- leadership request.
INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('links.hero.eyebrow', 'links', 'Links Hero Eyebrow', 'Link Tree & Civic Directory', 'text'),
  ('links.hero.headline', 'links', 'Links Hero Headline', 'Link Tree & Coalition Directory', 'text'),
  ('footer.nav.links', 'footer', 'Footer navigation link to links page', 'Link Tree & Action Links', 'text')
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = NOW();
