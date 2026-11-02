-- Seed the admin dashboard's events section copy into data_points.
--
-- src/app/admin/page.tsx added an "Upcoming Actions" panel that reads four
-- data-point keys:
--
--   admin.dashboard.events_title   — panel heading
--   admin.dashboard.view_events    — "All events" link text
--   admin.dashboard.no_events      — empty-state message
--   admin.dashboard.manage_events  — footer action link text
--
-- Without this seed the data-points guard reports them as "read but unseeded".
-- Every value below is the string the page renders today, so wiring each with
-- a DataPoint whose child is that string keeps SSR output identical.

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('admin.dashboard.events_title', 'admin', 'Upcoming Actions Panel Title', 'Upcoming Actions', 'text'),
  ('admin.dashboard.view_events', 'admin', 'View Events Link Text', 'All events', 'text'),
  ('admin.dashboard.no_events', 'admin', 'No Events Empty State', 'No upcoming events scheduled.', 'text'),
  ('admin.dashboard.manage_events', 'admin', 'Manage Events Link Text', 'Manage events & mobilizations', 'text')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = now();
