-- Complete the data-point rows for content that is rendered through DataPoint.
--
-- The partner, coalition-link and FAQ cards are dynamic rows: their fallback
-- text comes from their own tables, but their editable copy is read from
-- public.data_points. Seeding those keys here keeps every rendered
-- [data-data-point] field present in Supabase, while DO NOTHING preserves any
-- copy an editor has already customized.
INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('home.impact.districts_label', 'home', 'Impact Districts Label', 'Congressional Districts', 'text'),
  ('choir.videos.desc', 'choir', 'Choir Videos Description', 'Demonstrations at Fair Oaks Blvd & Manzanita Ave in Carmichael, CA.', 'text')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  group_name = EXCLUDED.group_name,
  label = EXCLUDED.label,
  updated_at = NOW();

INSERT INTO public.data_points (key, group_name, label, value, content_type)
SELECT
  'partner.' || p.slug || '.category',
  'partners',
  p.name || ' Category',
  p.category,
  'text'
FROM public.partners p
WHERE p.slug IS NOT NULL AND p.slug <> ''
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.data_points (key, group_name, label, value, content_type)
SELECT
  'partner.' || p.slug || '.name',
  'partners',
  p.name || ' Name',
  p.name,
  'text'
FROM public.partners p
WHERE p.slug IS NOT NULL AND p.slug <> ''
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.data_points (key, group_name, label, value, content_type)
SELECT
  'partner.' || p.slug || '.description',
  'partners',
  p.name || ' Description',
  p.description,
  'text'
FROM public.partners p
WHERE p.slug IS NOT NULL AND p.slug <> ''
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.data_points (key, group_name, label, value, content_type)
SELECT
  'faq.' || f.slug || '.question',
  'faqs',
  f.slug || ' Question',
  f.question,
  'text'
FROM public.faqs f
WHERE f.slug IS NOT NULL AND f.slug <> ''
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.data_points (key, group_name, label, value, content_type)
SELECT
  'faq.' || f.slug || '.answer',
  'faqs',
  f.slug || ' Answer',
  f.answer,
  'text'
FROM public.faqs f
WHERE f.slug IS NOT NULL AND f.slug <> ''
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.data_points (key, group_name, label, value, content_type)
SELECT
  'link.' || l.slug || '.name',
  'links',
  l.slug || ' Title',
  l.name,
  'text'
FROM public.coalition_links l
WHERE l.slug IS NOT NULL AND l.slug <> ''
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.data_points (key, group_name, label, value, content_type)
SELECT
  'link.' || l.slug || '.desc',
  'links',
  l.slug || ' Description',
  l.description,
  'text'
FROM public.coalition_links l
WHERE l.slug IS NOT NULL AND l.slug <> ''
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.data_points (key, group_name, label, value, content_type)
SELECT
  'link.' || l.slug || '.badge',
  'links',
  l.slug || ' Badge',
  l.badge,
  'text'
FROM public.coalition_links l
WHERE l.slug IS NOT NULL AND l.slug <> ''
  AND NULLIF(BTRIM(l.badge), '') IS NOT NULL
ON CONFLICT (key) DO NOTHING;
