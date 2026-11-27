-- Issue #183: Erin confirmed the chapter's current active-member count is 300+
-- (2026-11-25). `home.impact.neighbors` is the live CMS value rendered by
-- HomeHero; changing only the JSX fallback would leave the hosted homepage on
-- the old 500+ row. Keep the fallback in HomeHero.tsx in step so a fresh or
-- CMS-less environment renders the same number.
insert into public.data_points (key, group_name, label, value, content_type)
values
  ('home.impact.neighbors', 'home', 'Impact Neighbors Count', '300+', 'text')
on conflict (key) do update
set
  value = excluded.value,
  updated_at = now();
