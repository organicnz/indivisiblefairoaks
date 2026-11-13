-- Seed the two archive links added to the site footer.
--
-- The footer components render DataPoint fallbacks, but the data-points gate
-- requires every read key to have a matching seed row. These values match the
-- rendered fallbacks so the first paint and the CMS copy agree.

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
    ('footer.nav.archive', 'footer', 'Footer navigation link to legacy archive', 'Legacy Chapter Archive', 'text'),
    ('footer.bottom.archive', 'footer', 'Footer bottom bar archive link', 'Archive', 'text')
ON CONFLICT (key) DO NOTHING;
