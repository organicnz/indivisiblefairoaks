-- Seed extra choir audio player controls and labels into public.data_points
INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('choir.player.live_broadcast', 'choir', 'Choir Player Live Web Broadcast Badge', 'Live Web Broadcast', 'text'),
  ('choir.player.retry_btn', 'choir', 'Choir Player Retry Stream Button', 'Retry', 'text'),
  ('choir.player.next_station_btn', 'choir', 'Choir Player Next Station Button', 'Next Station', 'text'),
  ('choir.player.tune_anywhere_btn', 'choir', 'Choir Player Tune Anywhere Button', 'Tune from Anywhere', 'text'),
  ('choir.player.custom_title_placeholder', 'choir', 'Choir Player Custom Stream Title Placeholder', 'Stream Title (optional)', 'text')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  updated_at = NOW();
