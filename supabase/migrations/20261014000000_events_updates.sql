-- Migration: 20261014000000_events_updates.sql
-- Updates civic events table to remove past September events, update monthly chapter meeting to November 10,
-- add No Kings 4 (October 17), and establish ongoing street corner singing protest.

DELETE FROM public.events
WHERE slug IN ('good-trouble-weekend', 'deep-canvass-training', 'fall-postcards-drive', 'monthly-gathering-sep');

INSERT INTO public.events
    (slug, title, category, date_label, time_label, starts_at, ends_at,
     location_name, address, description, rsvp_url, highlight, sort_order)
VALUES
    ('monthly-gathering-nov', 'Monthly Chapter Gathering & Food Bank Drive', 'Meetings',
     'Tuesday, November 10, 2026', '6:30 PM – 8:00 PM',
     '2026-11-10T18:30:00-08:00', '2026-11-10T20:00:00-08:00',
     'St. Michael''s Episcopal Church', '2140 Mission Avenue, Carmichael, CA 95608',
     'Our primary monthly community gathering. Agenda includes post-election debrief and organizing strategies, federal and local updates, and a food drive for our neighborhood pantry. Please bring canned or non-perishable goods.',
     'https://www.mobilize.us/indivisible/', true, 10),
    ('no-kings-4', 'No Kings 4: Peaceful Protest & Stand-Out for Constitutional Democracy', 'Rallies & Street Action',
     'Saturday, October 17, 2026', '10:00 AM – 12:00 PM',
     '2026-10-17T10:00:00-07:00', '2026-10-17T12:00:00-07:00',
     'Fair Oaks Public Square & Intersection', 'Fair Oaks Blvd & Sunrise Blvd, Fair Oaks, CA',
     'Stand with Indivisible Fair Oaks-Carmichael in defense of constitutional democracy, equal justice under law, and judicial accountability. Bring your homemade signs, American flags, and comfortable shoes. Strictly nonviolent.',
     'https://www.mobilize.us/indivisible/', true, 15),
    ('singing-protest-ongoing', 'Carmichael Resistance Choir: Street Corner Singing Protest', 'Resistance Choir',
     'Ongoing Every Saturday Afternoon', '3:00 PM – 4:30 PM',
     '2026-10-17T15:00:00-07:00', '2026-10-17T16:30:00-07:00',
     'Carmichael Corner Demonstration', 'Corner of Fair Oaks Blvd & Manzanita Ave, Carmichael, CA',
     'Ongoing street corner singing demonstration to afternoon traffic and community patrons. We sing protest anthems, chants of courage, and songs of resistance. Bring your signs, lawn chairs, and voices to stand up for democracy!',
     'https://www.mobilize.us/indivisible/event/1011420/', false, 25),
    ('choir-rehearsal-biweekly', 'Carmichael Resistance Choir Bi-Weekly Rehearsal', 'Resistance Choir',
     'Every Other Wednesday', '6:30 PM – 8:00 PM',
     '2026-10-21T18:30:00-07:00', '2026-10-21T20:00:00-07:00',
     'Community Center / Church Hall', 'Carmichael, CA (Address provided upon registration)',
     'Learn 4-part harmonies, freedom anthems, and chants of resistance. No auditions or singing experience required — all voices are warmly welcomed!',
     'mailto:contact@indivisiblefairoaks.org?subject=Join%20Resistance%20Choir', false, 30)
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
