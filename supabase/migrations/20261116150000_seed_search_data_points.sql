-- Keep the rewritten search masthead and empty state editable. The old
-- `search.empty.btn` value described the retired storefront, so it is replaced
-- with the newsroom hand-off the current empty state renders.

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('search.header.eyebrow', 'search', 'Search Header Eyebrow', 'Search the chapter', 'text'),
  ('search.results.logbook', 'search', 'Search Results Logbook Header', 'From the logbook & pages', 'text'),
  ('search.empty.btn', 'search', 'Search Empty Button', 'Browse the newsroom', 'text')
ON CONFLICT (key) DO UPDATE SET
  group_name = EXCLUDED.group_name,
  label = EXCLUDED.label,
  value = EXCLUDED.value,
  content_type = EXCLUDED.content_type;
