-- The chapter store and its products snapshot were retired, but WALL-E still
-- advertised "gear" in its prompt tip and suggestion chip. Those prompts invited
-- a question with no live source behind it. Keep the existing key so the
-- data-point contract does not orphan a row; only the visitor-facing copy moves.

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('walle.prompt_tip', 'walle', 'WALL-E Prompt Suggestion', 'Ask about events, voter resources, partners, or getting involved.', 'text'),
  ('walle.chip.signs', 'walle', 'WALL-E Chip: Get Involved', '🤝 Get Involved', 'text')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = now();
