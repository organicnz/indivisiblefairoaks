-- Seed data points that the app reads but no earlier seed wave inserted.
--
-- These three predate the seed-parity guard: the screens referenced them in
-- `dataPoints[...]` / `name=` lookups, so they worked only as long as the JSX
-- fallback was acceptable. They now exist in the DB like every other key.
--
-- Values are the rendered fallbacks from src/app/cart/page.tsx and
-- src/app/choir/page.tsx, so a DB edit and the pre-hydration paint agree.

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('cart.notice.cause', 'cart', 'Cart Cause Notice', '100% of proceeds fund local civic actions & grassroots organizing', 'text'),
  ('choir.join.title', 'choir', 'Choir Join CTA Title', 'Ready to Sing With Us?', 'text'),
  ('choir.join.desc', 'choir', 'Choir Join CTA Description', 'You don''t need to be a trained musician. If you have a heart for justice and a voice to lend, you belong in our choir.', 'text')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = now();
