-- `norcal-brake-light` was seeded with a storage path whose object was never
-- uploaded. The public URL returns NoSuchKey, so the gallery card falls back to
-- "Photo unavailable" and the image optimizer logs a 400. Remove only this
-- exact seed row; if the photo is uploaded later, re-add it with a valid path.
DELETE FROM public.gallery_photos
WHERE slug = 'norcal-brake-light'
  AND storage_path = 'gallery/norcal-resist-brake-light-clinic.jpg';
