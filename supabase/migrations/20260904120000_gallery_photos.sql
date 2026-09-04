-- gallery_photos — single source of truth for all gallery imagery.
--
-- Replaces hardcoded static arrays in:
--   src/components/home/HeroPhotoFrame.tsx      (HERO_PHOTOS + PAIR_PHOTOS)
--   src/components/home/HomeGalleryPreview.tsx  (PREVIEW_PHOTOS)
--   src/app/gallery/page.tsx                    (STATIC_GALLERY)
--
-- Design:
--   * storage_path  — relative path within the 'media' bucket (e.g. 'gallery/foo.jpg').
--                     Never stored as a full URL so storage bucket or project
--                     migrations only require a config change, not a data migration.
--   * is_hero       — controls which photos cycle in HeroPhotoFrame (top 4 ordered by sort_order).
--   * is_pair       — controls the fixed pair row in HeroPhotoFrame.
--   * category      — matches the filter chips on HomeGalleryPreview + gallery page.
--   * sort_order    — explicit display ordering independent of insertion time.
--   * RLS: anon + authenticated SELECT only. Writes are service_role only (admin dashboard).
--   * Seeded from the exact 13 photos currently hardcoded across all three components.
--   * Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public.gallery_photos (
  id            SERIAL PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  storage_path  TEXT NOT NULL,
  alt           TEXT NOT NULL DEFAULT '',
  caption       TEXT NOT NULL DEFAULT '',
  location      TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT '',
  sign_quote    TEXT,
  date_label    TEXT NOT NULL DEFAULT '',
  photographer  TEXT NOT NULL DEFAULT 'Indivisible Fair Oaks Archive',
  is_hero       BOOLEAN NOT NULL DEFAULT false,
  is_pair       BOOLEAN NOT NULL DEFAULT false,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gallery_photos_sort_idx    ON public.gallery_photos (sort_order);
CREATE INDEX IF NOT EXISTS gallery_photos_category_idx ON public.gallery_photos (category);
CREATE INDEX IF NOT EXISTS gallery_photos_hero_idx    ON public.gallery_photos (is_hero, sort_order)
  WHERE is_hero = true;

ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public gallery viewable" ON public.gallery_photos;
CREATE POLICY "Public gallery viewable"
  ON public.gallery_photos
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.gallery_photos TO anon, authenticated;

-- ── Seed — exact 13 photos currently hardcoded ────────────────────────────────
INSERT INTO public.gallery_photos
  (slug, storage_path, alt, caption, location, category, sign_quote, date_label, is_hero, is_pair, sort_order)
VALUES
  ('no-kings-constitution-banner',
   'gallery/no-kings-constitution-banner.jpg',
   'Chapter members with handcrafted constitutional rights banner',
   'No Kings in America: Chapter Members with Handcrafted Constitutional Rights Banner',
   'Fair Oaks Blvd & Sunrise Blvd, Fair Oaks',
   'No Kings Sacramento',
   'No Kings In America — The Constitution',
   'Chapter Stand-Out',
   true, false, 10),

  ('unity-be-brave',
   'gallery/unity-be-brave-with-us.jpg',
   'Be Brave With Us solidarity stand-out',
   'Be Brave With Us! Solidarity Line',
   'Fair Oaks Blvd & Sunrise Blvd',
   'Sacramento Unity',
   'Be Brave With Us! Indivisible Fair Oaks',
   'Boulevard Stand-Out',
   true, false, 20),

  ('witty-grandfather',
   'gallery/witty-grandfather-ww2-antifa.jpg',
   'Witty WW2 antifa protest sign',
   'Historical Truth On Cardboard',
   'Fair Oaks Boulevard',
   'Witty & Funny Signs',
   'If Your Grandfather Fought In WW2 He Was Anti-Fascist!',
   'Sidewalk Action',
   true, false, 30),

  ('legacy-highway-banner',
   'gallery/highway-overpass-good-trouble.jpg',
   'Good Trouble banner drop on Highway 50 overpass',
   'Highway 50 Good Trouble Banner Drop',
   'Highway 50 Pedestrian Overpass',
   'Legacy Site Archives',
   'Good Trouble Lives On! Honoring John Lewis',
   'Annual Highway Action',
   true, false, 40),

  ('choir-outdoor',
   'gallery/choir-outdoor-rehearsal.jpg',
   'Carmichael Resistance Choir outdoor rehearsal',
   'Carmichael Resistance Choir Outdoor Rehearsal',
   'Carmichael Community Park',
   'Resistance Choir',
   'Singing For Democracy Under The Trees',
   'Vocal Resistance Rehearsal',
   false, true, 50),

  ('norcal-voter-rights',
   'gallery/voter-registration-homeless-vote.jpg',
   'Grassroots voter registration action',
   'Grassroots Voter Registration Action',
   'Sacramento Community Hub',
   'NorCal Resist',
   'Homeless Does Not Mean Voteless',
   'Civic Engagement Drive',
   false, true, 60),

  ('no-kings-standout',
   'gallery/no-kings-roadside-standout.jpg',
   'Gold Country Blvd grassroots mobilization',
   'Gold Country Blvd Grassroots Mobilization',
   'Gold Country Blvd, Fair Oaks',
   'No Kings Sacramento',
   'No ICE, No War, No King',
   'Weekend Stand-Out',
   false, false, 70),

  ('norcal-mutual-aid',
   'gallery/mutual-aid-fair-oaks-park.jpg',
   'Indivisible mutual aid and food drive',
   'Indivisible Mutual Aid & Food Drive',
   'Fair Oaks Park Pavilion',
   'NorCal Resist',
   'Mutual Aid Across Every Neighborhood',
   'Community Food Drive',
   false, false, 80),

  ('unity-one-voice',
   'gallery/unity-one-voice-vote-counts.jpg',
   'Sacramento grassroots democracy stand-out',
   'Sacramento Grassroots Democracy Stand-Out',
   'Fair Oaks Village Center',
   'Sacramento Unity',
   'One Voice — Your Vote Counts In CA',
   'Community Gathering',
   false, false, 90),

  ('witty-cat-nope',
   'gallery/witty-cat-nope-since-1776.jpg',
   'Satirical grassroots wit sign',
   'Satirical Grassroots Wit',
   'Carmichael Community Sidewalk',
   'Witty & Funny Signs',
   'Democracy Needs Your Courage (NOPE Since 1776)',
   'Grassroots Rally',
   false, false, 100),

  ('legacy-foam-hands',
   'gallery/highway-overpass-foam-hands.jpg',
   'Overpass waves to Highway 50 commuters',
   'Overpass Waves to Highway 50 Commuters',
   'Highway 50 Overpass, Sacramento',
   'Legacy Site Archives',
   'Waving For Democracy & Justice',
   'Overpass Action',
   false, false, 110),

  ('legacy-official-banner',
   'gallery/legacy-chapter-official-banner.jpg',
   'Official chapter welcome banner',
   'Official Chapter Welcome Banner',
   'Fair Oaks & Carmichael, CA',
   'Legacy Site Archives',
   'Indivisible Fair Oaks - Carmichael',
   'Historic Chapter Archive',
   false, false, 120),

  ('norcal-brake-light',
   'gallery/norcal-resist-brake-light-clinic.jpg',
   'NorCal Resist brake light clinic community action',
   'NorCal Resist Free Brake Light Clinic',
   'Carmichael Community Center',
   'NorCal Resist',
   'Free Brake Light Repairs — No Questions Asked',
   'Community Safety Clinic',
   false, false, 130)
ON CONFLICT (slug) DO NOTHING;
