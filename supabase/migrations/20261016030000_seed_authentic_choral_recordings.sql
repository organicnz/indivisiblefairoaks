-- ==============================================================================
-- Migration: 20261016030000_seed_authentic_choral_recordings.sql
-- Description: Updates Resistance Radio default station data points to authentic,
--              high-fidelity public domain choral recordings from official archives.
-- ==============================================================================

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('choir.player.track1_title', 'choir', 'Track 1 Title', 'America the Beautiful', 'text'),
  ('choir.player.track1_artist', 'choir', 'Track 1 Artist', 'U.S. Singing Sergeants Choral', 'text'),
  ('choir.player.track1_notes', 'choir', 'Track 1 Notes', 'Official public domain choral arrangement of Katherine Lee Bates anthem', 'text'),
  ('choir.player.track2_title', 'choir', 'Track 2 Title', 'Shenandoah (A Cappella)', 'text'),
  ('choir.player.track2_artist', 'choir', 'Track 2 Artist', 'U.S. Singing Sergeants Choral', 'text'),
  ('choir.player.track2_notes', 'choir', 'Track 2 Notes', 'Traditional American folk hymn arranged for rich multi-part vocal choir', 'text'),
  ('choir.player.track3_title', 'choir', 'Track 3 Title', 'Battle Hymn of Peace & Freedom', 'text'),
  ('choir.player.track3_artist', 'choir', 'Track 3 Artist', 'Grassroots Community Chorus', 'text'),
  ('choir.player.track3_notes', 'choir', 'Track 3 Notes', 'Historical choral rallying anthem for collective resilience and civil rights', 'text'),
  ('choir.player.track4_title', 'choir', 'Track 4 Title', 'Ode to Joy (Song of Peace)', 'text'),
  ('choir.player.track4_artist', 'choir', 'Track 4 Artist', 'Beethoven Choral Symphony No. 9', 'text'),
  ('choir.player.track4_notes', 'choir', 'Track 4 Notes', 'Universal anthem of brotherhood, democracy, human dignity, and solidarity', 'text'),
  ('choir.player.track5_title', 'choir', 'Track 5 Title', 'Ave Maria (Sacred Choral)', 'text'),
  ('choir.player.track5_artist', 'choir', 'Track 5 Artist', 'Sea Chanters Choral Ensemble', 'text'),
  ('choir.player.track5_notes', 'choir', 'Track 5 Notes', 'U.S. Navy Band Sea Chanters choral presentation for community harmony', 'text')
ON CONFLICT (key) DO UPDATE
SET
  label = EXCLUDED.label,
  value = EXCLUDED.value,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = now();
