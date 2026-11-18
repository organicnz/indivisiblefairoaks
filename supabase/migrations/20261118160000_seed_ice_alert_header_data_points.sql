-- Seed the page-level copy that the ICE Alert header now reads through
-- DataPoint. DO NOTHING preserves any wording an editor has already saved;
-- these rows only give a first deploy the same labels the fallback JSX paints.
INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('ice.header.title', 'ice', 'ICE Alert Header Title', 'ICE Alert', 'text'),
  ('ice.header.tagline', 'ice', 'ICE Alert Header Tagline', 'National rapid response', 'text'),
  ('ice.header.descriptor', 'ice', 'ICE Alert Header Descriptor', 'Community + official / city-level only / not 911', 'text'),
  ('ice.history.kicker', 'ice', 'Historical Map Kicker', 'Historical FOIA release / Interactive city map', 'text'),
  ('ice.history.title', 'ice', 'Historical Map Title', 'ICE arrests, mapped', 'text'),
  ('ice.history.safety', 'ice', 'Historical Map Safety Note', 'This map is historical and interactive. It cannot show current enforcement activity, identify a street-level event, or dispatch help. If you encounter enforcement activity, you can carefully observe or film from a safe distance; do not interfere or obstruct. Filming in public is generally protected by the First Amendment.', 'text'),
  ('ice.history.back', 'ice', 'Historical Map Back Link', 'Back to the rapid-response map', 'text')
ON CONFLICT (key) DO NOTHING;
