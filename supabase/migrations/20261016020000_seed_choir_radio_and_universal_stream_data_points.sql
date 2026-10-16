-- ==============================================================================
-- Migration: 20261016020000_seed_choir_radio_and_universal_stream_data_points.sql
-- Description: Seeds data points for the upgraded Choir Audio Player / Resistance Radio,
--              supporting dynamic stations, real songs, custom stream URLs, and audio metadata.
-- ==============================================================================

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('choir.player.radio_title', 'choir', 'Choir Radio Station Title', 'Resistance Radio', 'text'),
  ('choir.player.radio_subtitle', 'choir', 'Choir Radio Tagline', 'A browser-based harmonic broadcast and community protest songs for peaceful organizing. Tune into any stream from anywhere.', 'text'),
  ('choir.player.custom_stream_label', 'choir', 'Custom Stream Section Label', 'Custom Audio Stream / Song URL from Anywhere', 'text'),
  ('choir.player.custom_stream_placeholder', 'choir', 'Custom Stream URL Placeholder', 'Paste direct MP3, AAC, or live stream URL (https://...)', 'text'),
  ('choir.player.custom_stream_btn', 'choir', 'Custom Stream Tune Button', 'Tune In', 'text'),
  ('choir.player.now_broadcasting', 'choir', 'Now Broadcasting Label', 'Now broadcasting', 'text'),
  ('choir.player.status_live', 'choir', 'Live Choral Harmonic Status', 'Live Harmonic Stream', 'text'),
  ('choir.player.status_stream', 'choir', 'Direct Audio Stream Status', 'Direct Audio Broadcast', 'text'),
  ('choir.player.status_custom', 'choir', 'Custom Web Stream Status', 'Custom Web Stream', 'text'),
  ('choir.player.volume_label', 'choir', 'Volume Slider Label', 'Broadcast volume', 'text'),
  ('choir.player.prev_btn_label', 'choir', 'Previous Station Button Label', 'Previous station', 'text'),
  ('choir.player.next_btn_label', 'choir', 'Next Station Button Label', 'Next station', 'text'),
  ('choir.player.play_label', 'choir', 'Play Button Label', 'Play audio broadcast', 'text'),
  ('choir.player.pause_label', 'choir', 'Pause Button Label', 'Pause audio broadcast', 'text'),
  ('choir.player.stations_heading', 'choir', 'Stations List Heading', 'Community Stations & Anthems', 'text'),
  ('choir.player.track1_title', 'choir', 'Track 1 Title', 'Singing for Our Lives', 'text'),
  ('choir.player.track1_artist', 'choir', 'Track 1 Artist', 'Carmichael Resistance Choir', 'text'),
  ('choir.player.track1_notes', 'choir', 'Track 1 Notes', 'Holly Near anthem arranged for community 4-part harmony', 'text'),
  ('choir.player.track2_title', 'choir', 'Track 2 Title', 'Ain’t Gonna Let Nobody Turn Me Around', 'text'),
  ('choir.player.track2_artist', 'choir', 'Track 2 Artist', 'Carmichael Resistance Choir', 'text'),
  ('choir.player.track2_notes', 'choir', 'Track 2 Notes', 'Traditional civil rights march anthem', 'text'),
  ('choir.player.track3_title', 'choir', 'Track 3 Title', 'We Shall Not Be Moved', 'text'),
  ('choir.player.track3_artist', 'choir', 'Track 3 Artist', 'Carmichael Resistance Choir', 'text'),
  ('choir.player.track3_notes', 'choir', 'Track 3 Notes', 'Union and freedom struggle rallying song', 'text'),
  ('choir.player.track4_title', 'choir', 'Track 4 Title', 'Ode to Joy (Song of Peace)', 'text'),
  ('choir.player.track4_artist', 'choir', 'Track 4 Artist', 'Beethoven Choral Symphony No. 9', 'text'),
  ('choir.player.track4_notes', 'choir', 'Track 4 Notes', 'Universal anthem of brotherhood, democracy, and solidarity', 'text'),
  ('choir.player.track5_title', 'choir', 'Track 5 Title', 'Battle Hymn of Peace & Freedom', 'text'),
  ('choir.player.track5_artist', 'choir', 'Track 5 Artist', 'Grassroots Community Chorus', 'text'),
  ('choir.player.track5_notes', 'choir', 'Track 5 Notes', 'Historical choral arrangement for collective resilience', 'text'),
  ('choir.player.stream_err_msg', 'choir', 'Audio Stream Error Fallback Message', 'Stream unavailable or blocked by CORS — falling back to live choral harmonizer.', 'text')
ON CONFLICT (key) DO UPDATE
SET
  label = EXCLUDED.label,
  value = EXCLUDED.value,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = now();
