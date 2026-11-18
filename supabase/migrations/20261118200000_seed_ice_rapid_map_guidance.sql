-- Seed the rapid-response map guidance and legend. DO NOTHING preserves any
-- wording an editor has already saved.
INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('ice.map.eyebrow', 'ice', 'Rapid Map Eyebrow', 'National rapid-response map', 'text'),
  ('ice.map.hint', 'ice', 'Rapid Map Hint', 'Pulsing = report under 4h. Pins are city centroids; the community export is nightly.', 'text'),
  ('ice.map.search.label', 'ice', 'Rapid Map Search Label', 'Find a U.S. city or address', 'text'),
  ('ice.map.search.help', 'ice', 'Rapid Map Search Help', 'Search moves the map only. It never creates or changes a report. Search text is sent to', 'text'),
  ('ice.map.legend.active', 'ice', 'Rapid Map Legend Active', 'Active <4h', 'text'),
  ('ice.map.legend.source_confirmed', 'ice', 'Rapid Map Legend Source Confirmed', 'Source-confirmed', 'text'),
  ('ice.map.legend.sighting', 'ice', 'Rapid Map Legend Sighting', 'Sighting', 'text'),
  ('ice.map.legend.earlier', 'ice', 'Rapid Map Legend Earlier', 'Earlier', 'text'),
  ('ice.map.legend.city_level', 'ice', 'Rapid Map Legend City Level', 'City-level locations only', 'text'),
  ('ice.map.selected.location_note', 'ice', 'Rapid Map Selected Location Note', 'City centroid, not a street address', 'text'),
  ('ice.map.empty.title', 'ice', 'Rapid Map Empty Detail Title', 'Select a pin or a feed item for details.', 'text'),
  ('ice.map.empty.body', 'ice', 'Rapid Map Empty Detail Description', 'The detail view shows the city, source status, and time. It never reveals a street address, plate, name, or immigration status.', 'text')
ON CONFLICT (key) DO NOTHING;
