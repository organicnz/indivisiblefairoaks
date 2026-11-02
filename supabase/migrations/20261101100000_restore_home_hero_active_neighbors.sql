-- Restore 500+ Active Neighbors block in copy-home-hero and ensure data_points table has authoritative values.
-- If someone cleared the block in the visual editor, copy-home-hero contained empty <br> tags.
UPDATE public.content
SET
  body = replace(
    replace(
      replace(body,
        '<div data-data-point="home.impact.neighbors" class="text-2xl sm:text-3xl font-black text-foreground dark:text-white tracking-tight"><br></div>',
        '<div data-data-point="home.impact.neighbors" class="text-2xl sm:text-3xl font-black text-foreground dark:text-white tracking-tight">500+</div>'
      ),
      '<div data-data-point="home.impact.neighbors_label" class="text-xs text-muted-foreground dark:text-ink-muted-on-dark font-medium mt-0.5"><br></div>',
      '<div data-data-point="home.impact.neighbors_label" class="text-xs text-muted-foreground dark:text-ink-muted-on-dark font-medium mt-0.5">Active Neighbors</div>'
    ),
    'contenteditable="false"',
    ''
  ),
  updated_at = now()
WHERE slug = 'copy-home-hero';

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('home.impact.neighbors',       'home', 'Impact Neighbors Count', '500+',            'text'),
  ('home.impact.neighbors_label', 'home', 'Impact Neighbors Label', 'Active Neighbors', 'text')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();
