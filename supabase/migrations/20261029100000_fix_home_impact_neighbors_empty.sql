-- The home page impact stats bar has four boxes. The first box
-- (neighbors count + label) was blank in production because the
-- data_points rows either had an empty value or were absent.
-- This migration ensures all four stat boxes have correct values.
INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('home.impact.neighbors',       'home', 'Impact Neighbors Count', '500+',            'text'),
  ('home.impact.neighbors_label', 'home', 'Impact Neighbors Label', 'Active Neighbors', 'text'),
  ('home.impact.postcards',       'home', 'Impact Postcards Count', '4,200+',           'text'),
  ('home.impact.postcards_label', 'home', 'Impact Postcards Label', 'Postcards Written','text'),
  ('home.impact.funding',         'home', 'Impact Funding Value',   '100%',             'text'),
  ('home.impact.funding_label',   'home', 'Impact Funding Label',   'Grassroots Funded','text'),
  ('home.impact.districts',       'home', 'Impact Districts Code',  'CA-03 / 06',       'text'),
  ('home.impact.districts_label', 'home', 'Impact Districts Label', 'Congressional Districts', 'text')
ON CONFLICT (key) DO UPDATE SET
  value      = EXCLUDED.value,
  label      = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = now()
  -- Only overwrite if the stored value is empty — a chapter that
  -- customised these numbers via the visual editor keeps their value.
  WHERE public.data_points.value = '' OR public.data_points.value IS NULL;
