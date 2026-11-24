-- The public community-source description now names every field the nightly
-- export withholds, rather than only street addresses and vehicle details.
-- Keep the CMS seed in step with the reader's fallback so the data-points gate
-- compares one sentence against itself.
INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('ice.rapid.sources.community.body', 'ice', 'Community Source Description', 'Public nightly export. We use city centroids and a short, generalized description built from the report''s public text, type, status, and timestamp. Street addresses, vehicle plates, contact details, and identities are never republished. Source-confirmed is the network''s label.', 'text')
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  updated_at = NOW();
