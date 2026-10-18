-- Seed data points for WALL-E interactive suggestion chips and quick actions
-- Appended as a standalone migration adhering to append-only policy.

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('walle.chip.events', 'walle', 'WALL-E Chip: Upcoming Events', '📅 Upcoming Events', 'text'),
  ('walle.chip.voter', 'walle', 'WALL-E Chip: Voter Resources', '🗳️ Voter Resources', 'text'),
  ('walle.chip.signs', 'walle', 'WALL-E Chip: Yard Signs & Gear', '🪧 Yard Signs & Gear', 'text'),
  ('walle.chip.partners', 'walle', 'WALL-E Chip: Coalition Partners', '🤝 Coalition Partners', 'text'),
  ('walle.action.clear', 'walle', 'WALL-E Reset Chat Button', 'Clear conversation', 'text'),
  ('walle.action.copy', 'walle', 'WALL-E Copy Response Button', 'Copy answer', 'text')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  updated_at = now();
