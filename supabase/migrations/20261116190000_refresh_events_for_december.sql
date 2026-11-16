-- Migration: 20261116170000_refresh_events_for_december.sql
--
-- Issue #175 / Erin's 2026-11-14 feedback:
--   * remove one-off events that had already happened before November 14,
--   * schedule the December 1 chapter meeting so the homepage and calendar
--     have the next meeting in the database.
--
-- Recurring rows are intentionally retained. Their date labels begin with
-- "Ongoing" or "Every"; the public event surfaces keep those visible after
-- their first occurrence.

DELETE FROM public.events
WHERE slug IN (
  'monthly-gathering-nov',
  'no-kings-4',
  'weekend-protest-song',
  'mobilize-1004390',
  'mobilize-931501',
  'mobilize-1033123',
  'mobilize-967302'
);

INSERT INTO public.events
    (slug, title, category, date_label, time_label, starts_at, ends_at,
     location_name, address, description, rsvp_url, highlight, sort_order)
VALUES
    ('monthly-gathering-dec', 'Monthly Chapter Meeting & Food Drive', 'Meetings',
     'Tuesday, December 1, 2026', '6:30 PM – 8:00 PM',
     '2026-12-01T18:30:00-08:00', '2026-12-01T20:00:00-08:00',
     'St. Michael''s Episcopal Church', '2140 Mission Avenue, Carmichael, CA 95608',
     'Our next monthly community gathering. Bring a can or box of non-perishable food for our neighborhood pantry; agenda and updates will be shared at the meeting.',
     'https://www.mobilize.us/indivisible/', true, 5)
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    category = EXCLUDED.category,
    date_label = EXCLUDED.date_label,
    time_label = EXCLUDED.time_label,
    starts_at = EXCLUDED.starts_at,
    ends_at = EXCLUDED.ends_at,
    location_name = EXCLUDED.location_name,
    address = EXCLUDED.address,
    description = EXCLUDED.description,
    rsvp_url = EXCLUDED.rsvp_url,
    highlight = EXCLUDED.highlight,
    sort_order = EXCLUDED.sort_order;
