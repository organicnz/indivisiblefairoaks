-- Seed additional data points for InteractiveNewslettersList and Bulletin controls
-- Appended as a standalone migration adhering to append-only policy.

INSERT INTO public.data_points (key, group_name, label, value)
VALUES
  ('news.bulletin_tag', 'news', 'News Bulletin Tag', 'Chapter Bulletin'),
  ('news.admin.btn_edit', 'news', 'Admin Edit Bulletin Button', 'Edit'),
  ('news.admin.btn_delete', 'news', 'Admin Delete Bulletin Button', 'Delete')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  updated_at = now();
