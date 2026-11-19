-- Issue #180: the homepage quick-hits panel is editable through the same
-- data_points system as the rest of the homepage. These defaults mirror the
-- component copy; DO NOTHING preserves any editor customization made after the
-- migration is applied.
INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('home.quick_hits.eyebrow', 'home', 'Home Quick Hits Eyebrow', 'Quick hits', 'text'),
  ('home.quick_hits.headline', 'home', 'Home Quick Hits Headline', 'Go straight to the work.', 'text'),
  ('home.quick_hits.intro', 'home', 'Home Quick Hits Intro', 'Monthly dates, Coffee Klatches, postcarding, and every chapter action are one click away.', 'text'),
  ('home.quick_hits.gatherings_label', 'home', 'Home Quick Hits Gatherings Label', 'Monthly gathering dates', 'text'),
  ('home.quick_hits.gatherings_detail', 'home', 'Home Quick Hits Gatherings Detail', 'Chapter business, food drive, and neighborhood updates.', 'text'),
  ('home.quick_hits.coffee_label', 'home', 'Home Quick Hits Coffee Label', 'Coffee Klatches', 'text'),
  ('home.quick_hits.coffee_detail', 'home', 'Home Quick Hits Coffee Detail', 'Small-table conversation and community connection.', 'text'),
  ('home.quick_hits.postcards_label', 'home', 'Home Quick Hits Postcards Label', 'Postcarding & outreach', 'text'),
  ('home.quick_hits.postcards_detail', 'home', 'Home Quick Hits Postcards Detail', 'Write, phone-bank, and canvass with neighbors.', 'text'),
  ('home.quick_hits.calendar_label', 'home', 'Home Quick Hits Calendar Label', 'Full chapter calendar', 'text'),
  ('home.quick_hits.calendar_detail', 'home', 'Home Quick Hits Calendar Detail', 'Every meeting, action, rehearsal, and training.', 'text'),
  ('home.quick_hits.signup_note', 'home', 'Home Quick Hits Signup Note', 'Ready to do more than show up? RSVP for a gathering or tell us which workgroup fits.', 'text'),
  ('home.quick_hits.rsvp_btn', 'home', 'Home Quick Hits RSVP Button', 'RSVP for a gathering', 'text'),
  ('home.quick_hits.workgroup_btn', 'home', 'Home Quick Hits Workgroup Button', 'Join a workgroup', 'text')
ON CONFLICT (key) DO NOTHING;
