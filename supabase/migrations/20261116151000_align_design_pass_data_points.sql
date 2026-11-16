-- Keep the CMS values in step with the sentence-case headings shipped in the
-- design-system pass, so the copy does not revert when Supabase resolves.

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('account.admin_required.title', 'account', 'Account Admin Required Warning Title', 'Administrator privileges required', 'text'),
  ('account.admin_bridge.title', 'account', 'Account Admin Bridge Title', 'Admin control & civic CRM', 'text'),
  ('account.password.updated_title', 'account', 'Account Password Updated Title', 'Password updated', 'text'),
  ('admin.crm.title', 'admin', 'CRM Title', 'Constituent directory', 'text'),
  ('admin.dashboard.events_title', 'admin', 'Upcoming Actions Panel Title', 'Upcoming actions', 'text')
ON CONFLICT (key) DO UPDATE SET
  group_name = EXCLUDED.group_name,
  label = EXCLUDED.label,
  value = EXCLUDED.value,
  content_type = EXCLUDED.content_type;
