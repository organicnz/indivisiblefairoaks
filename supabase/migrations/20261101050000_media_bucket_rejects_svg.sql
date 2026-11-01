-- Migration: 20261101050000_media_bucket_rejects_svg.sql
--
-- The `media` bucket allowed `image/svg+xml`. Every upload path in the
-- application rejects it, and says why in its own comment:
--
--   src/app/admin/actions.ts        "SVG is active content and executes on the
--                                    storefront/storage origin (stored XSS)"
--   src/lib/actions/content.ts       "SVG is excluded deliberately…"
--   src/lib/actions/content-media.ts CONTENT_IMAGE_TYPES: JPEG, PNG, WebP, GIF
--   src/lib/actions/crm.ts           "SVG is prohibited to prevent stored XSS"
--
-- So the rule existed in four places and not in the place that can enforce it
-- for all of them. A fifth upload path that forgets the check would have been
-- accepted by storage; this makes the bucket the backstop rather than the hole.
--
-- The bucket holds 85 objects — 80 jpg, 5 ogg, zero svg — and the list only
-- governs new uploads, so nothing existing becomes unreachable. Audio types are
-- kept: the bucket already serves them (the five ogg files), and this change is
-- about active content, not about narrowing scope.
--
-- `avatars` keeps its raster-only list; it is unused by the application (no code
-- references it), so its policies are inert either way.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/mpeg',
  'audio/ogg',
  'audio/mp3',
  'audio/wav',
  'audio/x-m4a',
  'audio/aac',
  'audio/webm'
]
WHERE id = 'media';
