-- Seed the historical ICE sidebar and alert-feed copy exposed through
-- DataPoint. DO NOTHING preserves editor changes already saved.
INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('ice.sidebar.snapshot.eyebrow', 'ice', 'Historical Sidebar Eyebrow', 'Snapshot at a glance', 'text'),
  ('ice.sidebar.snapshot.title', 'ice', 'Historical Sidebar Title', 'A national picture, city by city.', 'text'),
  ('ice.sidebar.snapshot.body', 'ice', 'Historical Sidebar Introduction', 'The circles group nearby city totals built from the city named in each ICE arrest record. They are not a record of where every enforcement action happened, and they are not live.', 'text'),
  ('ice.sidebar.metric.mapped', 'ice', 'Historical Metric Mapped Records', 'Mapped records', 'text'),
  ('ice.sidebar.metric.cities', 'ice', 'Historical Metric City Points', 'City points', 'text'),
  ('ice.sidebar.metric.coverage', 'ice', 'Historical Metric Coverage', 'Coverage', 'text'),
  ('ice.sidebar.metric.max', 'ice', 'Historical Metric Highest City Total', 'Highest city total', 'text'),
  ('ice.sidebar.coverage.note', 'ice', 'Historical Coverage Note', 'Coverage is the share of all de-duplicated arrest records with a usable U.S. city and coordinates. The rest remain in the source data but are not on this map.', 'text'),
  ('ice.sidebar.cities.eyebrow', 'ice', 'Historical Cities Eyebrow', 'Highest assigned counts', 'text'),
  ('ice.sidebar.cities.title', 'ice', 'Historical Cities Title', 'Cities in the snapshot', 'text'),
  ('ice.sidebar.cities.body', 'ice', 'Historical Cities Introduction', 'Select a city in this list or open a city dot or cluster popup on the map to see its assigned count and context brief.', 'text'),
  ('ice.sidebar.selected.eyebrow', 'ice', 'Historical Selected City Eyebrow', 'Selected city', 'text'),
  ('ice.sidebar.selected.assigned', 'ice', 'Historical Selected City Assigned Label', 'Assigned records', 'text'),
  ('ice.sidebar.selected.rank', 'ice', 'Historical Selected City Rank Label', 'National rank', 'text'),
  ('ice.sidebar.selected.note', 'ice', 'Historical Selected City Note', 'The circle is a Census place point, not an exact arrest address.', 'text'),
  ('ice.sidebar.selected.detail', 'ice', 'Historical Selected City Detail', 'This FOIA extract is aggregated by city; it does not include individual names, case narratives, or photographs. Every record represents a person, and the brief below explains the selected total without inventing their identity. It is not a case file.', 'text'),
  ('ice.sidebar.source.eyebrow', 'ice', 'Historical Source Eyebrow', 'Source & release', 'text'),
  ('ice.sidebar.source.link', 'ice', 'Historical Source Link', 'Read the source', 'text'),

  ('ice.feed.eyebrow', 'ice', 'Alert Feed Eyebrow', 'Community + official feed', 'text'),
  ('ice.feed.title', 'ice', 'Alert Feed Title', 'Recent reports', 'text'),
  ('ice.feed.card.earlier', 'ice', 'Alert Feed Earlier Label', 'Earlier', 'text'),
  ('ice.feed.card.location', 'ice', 'Alert Feed Location Label', 'City-level location', 'text'),
  ('ice.feed.card.source_link', 'ice', 'Alert Feed Source Link', 'Source report', 'text'),
  ('ice.feed.official.badge', 'ice', 'Official Release Badge', 'Official ICE release', 'text'),
  ('ice.feed.official.link', 'ice', 'Official Release Link', 'Read the official release', 'text'),
  ('ice.feed.empty.community.title', 'ice', 'Community Feed Empty Title', 'No reports match this view.', 'text'),
  ('ice.feed.empty.community.body', 'ice', 'Community Feed Empty Description', 'Try a different time window, status, or search. The map uses the same filters.', 'text'),
  ('ice.feed.empty.official.title', 'ice', 'Official Feed Empty Title', 'Official releases are unavailable.', 'text'),
  ('ice.feed.empty.official.body', 'ice', 'Official Feed Empty Description', 'The ICE newsroom feed did not return any releases. No replacement content is being invented.', 'text'),
  ('ice.feed.footer', 'ice', 'Alert Feed Source Note', 'This page checks for a new public export every 2 minutes; the community source compiles its export nightly. Source links open the original network, which may show more detail, including any community comments or updates. Official releases are summarized by topic so names and case details are not reproduced; open the release for the agency''s full text. They are not live enforcement locations. Source-confirmed means the reporting network''s label, not independent verification by this page.', 'text')
ON CONFLICT (key) DO NOTHING;
