-- Migration: 20261028120000_seed_legacy_coalition_links.sql
--
-- Issue #150: the chapter asked for "several Indivisible chapters" linked from
-- the site. Their Google Sites Links page (the pre-migration source, scanned
-- 2026-10-28) listed six sister chapters and three regional allies; only
-- Indivisible National survived the platform move. This restores the remainder
-- against the live `coalition_links` table — data, not code, so each row stays
-- editable through CivicLinkManager.
--
-- `ON CONFLICT DO NOTHING` keeps the seed idempotent and never overwrites an
-- organizer's edits. The static fallback in `src/app/links/page.tsx` mirrors
-- these rows on purpose: it only renders when the DB cannot be read, and the
-- two lists must not drift into different facts.

INSERT INTO public.coalition_links (slug, name, category, url, description, badge, sort_order)
VALUES
    ('indivisible-sacramento','Indivisible Sacramento','Movement Partners',
     'https://indivisiblesacramento.com',
     'Neighboring Indivisible chapter organizing in Sacramento.', NULL, 21),
    ('indivisible-yolo','Indivisible Yolo','Movement Partners',
     'https://www.indivisibleyolo.org',
     'Neighboring Indivisible chapter organizing in Yolo County.', NULL, 22),
    ('indivisible-roseville','Indivisible Roseville','Movement Partners',
     'https://www.indivisible-roseville-ca.org',
     'Neighboring Indivisible chapter organizing in Roseville.', NULL, 23),
    ('indivisible-eldorado','Indivisible El Dorado','Movement Partners',
     'https://www.indivisibleeldorado.org',
     'Neighboring Indivisible chapter organizing in El Dorado County.', NULL, 24),
    ('indivisible-elk-grove','Indivisible Elk Grove','Movement Partners',
     'https://indivisibleegt.com',
     'Neighboring Indivisible chapter organizing in Elk Grove.', NULL, 25),
    ('five-calls','5 Calls','Civic Education',
     'https://5calls.org',
     'An easy way to call your elected officials with scripts for every issue.', NULL, 26),
    ('norcal-resist','NorCal Resist','Movement Partners',
     'https://www.norcalresist.org',
     'Community members organizing for a better world through shared resources and support.', NULL, 27),
    ('american-river-dems','American River Democrats','Movement Partners',
     'https://www.ardems.org',
     'Community organization serving East Sacramento County communities.', NULL, 28)
ON CONFLICT (slug) DO NOTHING;
