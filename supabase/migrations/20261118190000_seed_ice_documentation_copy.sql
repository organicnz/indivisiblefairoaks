-- Seed the historical-map documentation section. DO NOTHING preserves any
-- wording an editor has already saved.
INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('ice.docs.eyebrow', 'ice', 'Documentation Eyebrow', 'Documentation & dignity', 'text'),
  ('ice.docs.title', 'ice', 'Documentation Title', 'Every record is a person.', 'text'),
  ('ice.docs.dignity', 'ice', 'Documentation Dignity Note', 'Each one represents a person. Many are our neighbors; all deserve dignity.', 'text'),
  ('ice.docs.transparency', 'ice', 'Documentation Transparency Note', 'The city-level extract used by this page does not identify those people by name, and this page will not invent a victim, a face, a family, or a story to fill that absence. We document only what the release actually contains: city totals, the period, the source, and the limits.', 'text'),
  ('ice.docs.documented.title', 'ice', 'Documented Records Heading', 'What is documented', 'text'),
  ('ice.docs.documented.note', 'ice', 'Documented Records Note', 'The source, method, and known gaps are documented in the source panel and reading guide above.', 'text'),
  ('ice.docs.not_documented.title', 'ice', 'Undocumented Records Heading', 'What is not documented', 'text'),
  ('ice.docs.not_documented.body', 'ice', 'Undocumented Records Note', 'This page has no individual case file, case number, street address, nationality, immigration status, photograph, or verified victim/community-member identity. We do not infer those from a city total.', 'text'),
  ('ice.docs.add.title', 'ice', 'Verified Account Heading', 'Adding a verified account', 'text'),
  ('ice.docs.add.body', 'ice', 'Verified Account Note', 'If the chapter has a consent-based, source-controlled case or memorial record, we can publish only what is verified and attributed. Do not send sensitive personal information through this page.', 'text'),
  ('ice.docs.closing', 'ice', 'Documentation Closing Note', 'To the people behind every record, their families, and the communities carrying this history: you are not a data point here. We will not pretend the release tells us more than it does.', 'text')
ON CONFLICT (key) DO NOTHING;
