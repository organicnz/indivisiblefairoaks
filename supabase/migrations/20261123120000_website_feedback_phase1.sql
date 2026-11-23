-- Website feedback (23 Nov 2026), phase 1.
--
-- Only `copy-home-hero` has a published CMS row, so these `data_points` rows
-- are the live copy on /about. Update them alongside the JSX fallbacks so the
-- rendered page and a freshly seeded environment cannot drift.

-- "Who We Are": drop the sentence Erin asked to remove. The remaining sentence
-- is the paragraph's whole point; the deleted sentence repeated other sections.
update public.data_points
set
  value = 'Our monthly gatherings provide a welcoming space for dialogue, education, and coordinated action.',
  updated_at = now()
where key = 'about.who.p2';

-- The About page now ends with the question and the two buttons; the sentence
-- beneath it was the copy Erin asked to drop. `about.join.body` is unused but
-- still holds that sentence in the hosted project; retiring it is a separate
-- content cleanup, not part of the applied phase-1 set.
update public.data_points
set
  value = 'Ready to get involved?',
  updated_at = now()
where key = 'about.join.headline';

-- Food drive: name the pantry the chapter actually supports, and record the
-- diaper collection and its destination.
update public.data_points
set
  value = 'We believe that civic justice begins with community care. At every in-person monthly gathering, our members bring non-perishable canned goods and staple foods to donate to the Carmichael Food Pantry. Diaper donations are also collected and go to Opening Doors, a local refugee resettlement program.',
  updated_at = now()
where key = 'about.foodbank.body';

-- December chapter meeting: the first-Tuesday rule and the direct Mobilize
-- registration link. The rule is the chapter's published one (also in the FAQ
-- and contact schedule); November 2026 was the exception, meeting on the second
-- Tuesday because the first was Election Day.
update public.events
set
  description = 'Our next monthly community gathering, held on the first Tuesday of each month. Bring a can or box of non-perishable food for the Carmichael Food Pantry, and diaper donations for Opening Doors, a local refugee resettlement program. Agenda and updates will be shared at the meeting.',
  rsvp_url = 'https://www.mobilize.us/indivisible/event/967302/',
  updated_at = now()
where slug = 'monthly-gathering-dec';

-- The choir's manual row points at the Mobilize rehearsal event. The hidden
-- sync duplicate is a hosted artifact; on a fresh project the sync's RSVP
-- duplicate guard converts this manual row instead of inserting a second.
update public.events
set
  rsvp_url = 'https://www.mobilize.us/indivisible/event/1072857/',
  updated_at = now()
where slug = 'choir-rehearsal-biweekly';
