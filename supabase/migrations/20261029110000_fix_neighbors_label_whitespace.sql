-- The home.impact.neighbors_label row may contain a whitespace-only value
-- (e.g. ' ' or '\u00a0') from an accidental visual-editor clear.
-- The previous fix migration (20261029100000) only caught empty-string and
-- NULL; a whitespace value is truthy in DataPoint's || chain and renders
-- invisibly, leaving the "Active Neighbors" label blank.
--
-- This migration unconditionally restores the correct label text.
-- A chapter that customised this value to something non-whitespace is
-- unlikely (it is a unit label, not a chapter-specific number), and the
-- correct default is authoritative here.
UPDATE public.data_points
SET
  value      = 'Active Neighbors',
  updated_at = now()
WHERE key = 'home.impact.neighbors_label';
