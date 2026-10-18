-- Retarget the admin data points seeded in 20261016130000 to the copy the
-- admin screens actually render.
--
-- That seed wave was authored against an admin revision that never shipped:
-- its values ("Operations Dashboard", "Chapter Store Catalog", "Supporters &
-- Donors", …) match no string in src/. Left alone, wiring the screens to these
-- keys would have silently rewritten the live admin copy to match the seeds.
-- The shipped strings are canonical, so the rows are corrected here first —
-- after this migration the DB value and the rendered copy agree, and only then
-- can a screen be wired with `dataPoints[key] || 'fallback'` and keep SSR
-- output identical whichever side wins.
--
-- Keys whose seed has no counterpart in the live UI are deliberately NOT
-- retargeted (admin.actions.*, admin.kpi.active_products/low_stock,
-- admin.dashboard.subtitle, the per-page subtitles, admin.crm.tab_*,
-- admin.content.btn_new): those are tracked in the data-points guard baseline
-- as `no-matching-ui` rather than being pointed at a string they do not name.
--
-- Also adds admin.nav.* for the section tabs AdminNav renders, which had no
-- seed at all.

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  -- Dashboard
  ('admin.dashboard.title', 'admin', 'Dashboard Title', 'Dashboard', 'text'),
  ('admin.kpi.revenue', 'admin', 'Revenue Metric', 'Revenue (30d)', 'text'),
  ('admin.kpi.orders', 'admin', 'Orders Metric', 'Orders (30d)', 'text'),
  ('admin.kpi.aov', 'admin', 'AOV Metric', 'Avg. order value', 'text'),
  ('admin.kpi.to_ship', 'admin', 'Queue Metric', 'Awaiting shipment', 'text'),
  ('admin.orders.title', 'admin', 'Pending Fulfilment Title', 'Pending fulfilment', 'text'),
  ('admin.orders.empty', 'admin', 'Pending Fulfilment Empty State', 'All caught up.', 'text'),
  ('admin.orders.view_all', 'admin', 'Orders View All', 'View orders', 'text'),
  ('admin.dashboard.coupons_title', 'admin', 'Coupons Section Title', 'Coupon usage (30d)', 'text'),
  ('admin.coupons.empty', 'admin', 'Coupons Empty State', 'No coupons yet. Create one above.', 'text'),
  -- CRM
  ('admin.crm.title', 'admin', 'CRM Title', 'Constituent Directory', 'text'),
  ('admin.crm.subtitle', 'admin', 'CRM Subtitle', 'Track activists, resist choir singers, grassroots donors, and local supporters across CA-06 and CA-03 with direct Resend outreach and campaign blasts.', 'text'),
  ('admin.crm.btn_compose', 'admin', 'Compose Button', 'Email Broadcasts', 'text'),
  -- Content
  ('admin.content.title', 'admin', 'Content Title', 'Pages & posts', 'text'),
  -- Products
  ('admin.products.title', 'admin', 'Products Title', 'Products', 'text'),
  ('admin.products.btn_new', 'admin', 'New Product Button', 'Add product', 'text'),
  -- Customers
  ('admin.customers.title', 'admin', 'Customers Title', 'Customers', 'text'),
  -- Coupons
  ('admin.coupons.title', 'admin', 'Coupons Title', 'Coupons', 'text'),
  ('admin.coupons.btn_new', 'admin', 'New Coupon Button', 'New Coupon', 'text'),
  -- Admin section navigation (AdminNav)
  ('admin.nav.dashboard', 'admin', 'Admin Nav Dashboard', 'Dashboard', 'text'),
  ('admin.nav.content', 'admin', 'Admin Nav Content', 'Pages', 'text'),
  ('admin.nav.crm', 'admin', 'Admin Nav CRM', 'Civic CRM', 'text'),
  ('admin.nav.orders', 'admin', 'Admin Nav Orders', 'Orders', 'text'),
  ('admin.nav.products', 'admin', 'Admin Nav Products', 'Products', 'text'),
  ('admin.nav.customers', 'admin', 'Admin Nav Customers', 'Customers', 'text'),
  ('admin.nav.coupons', 'admin', 'Admin Nav Coupons', 'Coupons', 'text'),
  ('admin.nav.aria', 'admin', 'Admin Nav Aria Label', 'Admin sections', 'text')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = now();
