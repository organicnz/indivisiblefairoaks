-- Migration: 20261116143000_seed_home_labels_data_points.sql
-- Keeps the last visible homepage labels in the same editable data_points table
-- as the rest of the copy. Event dates, titles and locations stay in `events`;
-- gallery categories, titles and locations stay in `gallery_photos`.

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('home.hero.location_stamp', 'home', 'Hero Location Stamp', 'Fair Oaks · Carmichael, CA', 'text'),
  ('home.gathering.food_bank_label', 'home', 'Gathering Food Bank Label', 'Food Bank Drive:', 'text')
ON CONFLICT (key) DO NOTHING;
