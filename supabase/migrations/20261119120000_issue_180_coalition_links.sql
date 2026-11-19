-- Issue #180: leadership asked for front-and-center links to the chapter's
-- coalition partners. Most were already in the link tree; this adds the missing
-- Coalition Against Project 2025, corrects Indivisible CA: StateStrong's public
-- name and URL, and mirrors the same organizations on the partners page.
--
-- The static fallbacks in src/components/links/links-fallback.ts and
-- src/components/partners/partners-fallback.ts carry identical facts for the
-- pre-migration and database-outage states.

INSERT INTO public.coalition_links (slug, name, category, url, description, badge, sort_order)
VALUES
  (
    'coalition-against-project-2025',
    'Coalition Against Project 2025',
    'Movement Partners',
    'https://www.opposeproject2025.org/',
    'A regional coalition opposing Project 2025, with partner organizations, a shared action calendar, and tools for local resistance.',
    NULL,
    29
  )
ON CONFLICT (slug) DO NOTHING;

UPDATE public.coalition_links
SET
  name = 'Indivisible CA: StateStrong',
  url = 'https://www.castatestrong.org/',
  description = 'A coalition of grassroots Indivisible groups across California, empowering constituents to make their voices heard in Sacramento and pass progressive state policy.'
WHERE slug = 'indivisible-ca';

INSERT INTO public.partners (slug, name, category, description, url, sort_order)
VALUES
  (
    'norcal-resist',
    'NorCal Resist',
    'Community Solidarity Partner',
    'Community members organizing for a better world through shared resources and support.',
    'https://www.norcalresist.org',
    55
  ),
  (
    'coalition-against-project-2025',
    'Coalition Against Project 2025',
    'National Democracy Coalition',
    'A regional coalition opposing Project 2025, with partner organizations, a shared action calendar, and tools for local resistance.',
    'https://www.opposeproject2025.org/',
    57
  )
ON CONFLICT (slug) DO NOTHING;

UPDATE public.partners
SET
  name = 'Indivisible CA: StateStrong',
  url = 'https://www.castatestrong.org/'
WHERE slug = 'indivisible-ca-statestrong';

UPDATE public.partners
SET url = 'https://www.lwvsacramento.org'
WHERE slug = 'lwv-sacramento';

-- The link and partner cards render their visible copy through data_points.
-- Seed every new field here; the ON CONFLICT clause also corrects the old
-- StateStrong name for deployments that already cached the previous copy.
INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  (
    'link.indivisible-ca.name',
    'links',
    'indivisible-ca Title',
    'Indivisible CA: StateStrong',
    'text'
  ),
  (
    'link.indivisible-ca.desc',
    'links',
    'indivisible-ca Description',
    'A coalition of grassroots Indivisible groups across California, empowering constituents to make their voices heard in Sacramento and pass progressive state policy.',
    'text'
  ),
  (
    'link.coalition-against-project-2025.name',
    'links',
    'coalition-against-project-2025 Title',
    'Coalition Against Project 2025',
    'text'
  ),
  (
    'link.coalition-against-project-2025.desc',
    'links',
    'coalition-against-project-2025 Description',
    'A regional coalition opposing Project 2025, with partner organizations, a shared action calendar, and tools for local resistance.',
    'text'
  ),
  (
    'partner.indivisible-ca-statestrong.name',
    'partners',
    'Indivisible CA: StateStrong Name',
    'Indivisible CA: StateStrong',
    'text'
  ),
  (
    'partner.norcal-resist.category',
    'partners',
    'NorCal Resist Category',
    'Community Solidarity Partner',
    'text'
  ),
  (
    'partner.norcal-resist.name',
    'partners',
    'NorCal Resist Name',
    'NorCal Resist',
    'text'
  ),
  (
    'partner.norcal-resist.description',
    'partners',
    'NorCal Resist Description',
    'Community members organizing for a better world through shared resources and support.',
    'text'
  ),
  (
    'partner.coalition-against-project-2025.category',
    'partners',
    'Coalition Against Project 2025 Category',
    'National Democracy Coalition',
    'text'
  ),
  (
    'partner.coalition-against-project-2025.name',
    'partners',
    'Coalition Against Project 2025 Name',
    'Coalition Against Project 2025',
    'text'
  ),
  (
    'partner.coalition-against-project-2025.description',
    'partners',
    'Coalition Against Project 2025 Description',
    'A regional coalition opposing Project 2025, with partner organizations, a shared action calendar, and tools for local resistance.',
    'text'
  )
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = NOW();
