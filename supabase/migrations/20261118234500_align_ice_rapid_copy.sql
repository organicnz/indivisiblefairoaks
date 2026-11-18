-- Keep the CMS defaults aligned with the ICE feed and source-memo copy.
-- The feed now exposes a state filter, and the community source description
-- names the short memo built from city, type, status, and timestamp.
INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('ice.feed.empty.community.body', 'ice', 'Community Feed Empty Description', 'Try a different state, time window, status, or search. The map uses the same filters.', 'text'),
  ('ice.rapid.sources.community.body', 'ice', 'Community Source Description', 'Public nightly export. We use city centroids and a short source memo built from the report''s city, type, status, and timestamp. The original export includes street addresses and vehicle details that we do not republish. Source-confirmed is the network''s label.', 'text')
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  updated_at = NOW();
