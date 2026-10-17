-- Enable audio MIME types on public media bucket and seed real choral audio stream data points
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml',
  'audio/mpeg', 'audio/ogg', 'audio/mp3', 'audio/wav', 'audio/x-m4a', 'audio/aac', 'audio/webm'
],
file_size_limit = 20971520
WHERE id = 'media';

INSERT INTO public.data_points (key, value, group_name, content_type, label)
VALUES
  ('choir.player.stream_err_msg', 'Audio stream temporarily unreachable. Tap Retry or select another station.', 'choir', 'text', 'Audio Stream Error Fallback Message'),
  ('choir.player.track1_url', 'audio/america-the-beautiful.ogg', 'choir', 'text', 'Track 1 Audio Storage URL'),
  ('choir.player.track1_artist', 'U.S. Navy Band Sea Chanters Choral', 'choir', 'text', 'Track 1 Artist'),
  ('choir.player.track2_title', 'The Star-Spangled Banner', 'choir', 'text', 'Track 2 Title'),
  ('choir.player.track2_artist', 'U.S. Army Field Band & Soldiers'' Chorus', 'choir', 'text', 'Track 2 Artist'),
  ('choir.player.track2_notes', 'Choral anthem with band accompaniment by the Soldiers'' Chorus', 'choir', 'text', 'Track 2 Notes'),
  ('choir.player.track2_url', 'audio/star-spangled-banner.ogg', 'choir', 'text', 'Track 2 Audio Storage URL'),
  ('choir.player.track3_title', 'Battle Hymn of the Republic', 'choir', 'text', 'Track 3 Title'),
  ('choir.player.track3_artist', 'U.S. Air Force Band & Singing Sergeants Choral', 'choir', 'text', 'Track 3 Artist'),
  ('choir.player.track3_notes', 'Historical choral rallying anthem for collective resilience, justice, and solidarity', 'choir', 'text', 'Track 3 Notes'),
  ('choir.player.track3_url', 'audio/battle-hymn-of-the-republic.ogg', 'choir', 'text', 'Track 3 Audio Storage URL'),
  ('choir.player.track4_title', 'Ode to Joy (Anthem of Peace & Europe)', 'choir', 'text', 'Track 4 Title'),
  ('choir.player.track4_artist', 'U.S. Navy Band Choral & Concert Orchestra', 'choir', 'text', 'Track 4 Artist'),
  ('choir.player.track4_notes', 'Universal anthem of brotherhood, human dignity, democracy, and solidarity', 'choir', 'text', 'Track 4 Notes'),
  ('choir.player.track4_url', 'audio/ode-to-joy.ogg', 'choir', 'text', 'Track 4 Audio Storage URL'),
  ('choir.player.track5_title', 'Ave Maria (Sacred Choral)', 'choir', 'text', 'Track 5 Title'),
  ('choir.player.track5_artist', 'Sea Chanters Choral Ensemble', 'choir', 'text', 'Track 5 Artist'),
  ('choir.player.track5_notes', 'Anton Bruckner choral presentation performed by U.S. Navy Band Sea Chanters', 'choir', 'text', 'Track 5 Notes'),
  ('choir.player.track5_url', 'audio/ave-maria.ogg', 'choir', 'text', 'Track 5 Audio Storage URL')
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  updated_at = now();
