-- Seed the admin dashboard's remaining presentation copy into data_points.
--
-- The dashboard already reads admin.dashboard.title, the admin.kpi.* metric
-- labels, admin.orders.title/empty/view_all and admin.dashboard.coupons_title.
-- This wave covers the user-visible strings on the same screen that had no seed
-- at all — the panel eyebrow, the section titles, the empty states, the status
-- and link labels, and the two data-absence fallbacks — so the CMS and the
-- visual editor can reach them instead of leaving them frozen in JSX.
--
-- Every value below is the string the screen renders today, so wiring each with
-- `dataPoints[key] || '<value>'` (or a DataPoint whose child is that string)
-- keeps SSR output identical whichever side wins, and the data-points guard
-- asserts the fallback agrees with the seed.
--
-- Deliberately NOT seeded: the chart legend micro-labels ("This period",
-- "Prior period"), the dynamic fragments ("{units} sold", "{n}↑ best day"),
-- and the raw WooCommerce status codes, which are data values rather than copy.

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('admin.panel.eyebrow', 'admin', 'Admin Panel Eyebrow', 'Admin Panel', 'text'),
  ('admin.dashboard.revenue_title', 'admin', 'Revenue Chart Title', 'Revenue — last 14 days', 'text'),
  ('admin.dashboard.top_products_title', 'admin', 'Top Products Title', 'Top products (30d)', 'text'),
  ('admin.dashboard.no_sales', 'admin', 'Top Products Empty State', 'No sales yet.', 'text'),
  ('admin.dashboard.status_title', 'admin', 'Order Status Title', 'Order status (30d)', 'text'),
  ('admin.dashboard.pending_view_all', 'admin', 'Pending Fulfilment View All', 'View all', 'text'),
  ('admin.dashboard.stock_title', 'admin', 'Stock Alerts Title', 'Stock alerts', 'text'),
  ('admin.dashboard.stock_ok', 'admin', 'Stock Alerts Empty State', 'All products in stock.', 'text'),
  ('admin.dashboard.stock_out', 'admin', 'Out Of Stock Label', 'Out of stock', 'text'),
  ('admin.dashboard.stock_backorder', 'admin', 'Backorder Label', 'Backorder', 'text'),
  ('admin.dashboard.manage_products', 'admin', 'Manage Products Link', 'Manage products', 'text'),
  ('admin.dashboard.manage_coupons', 'admin', 'Manage Coupons Link', 'Manage', 'text'),
  ('admin.dashboard.no_coupons', 'admin', 'Coupons Empty State', 'No coupons used yet.', 'text'),
  ('admin.dashboard.no_prior_data', 'admin', 'No Prior Data Label', 'No prior data', 'text'),
  ('admin.dashboard.guest', 'admin', 'Guest Customer Fallback', 'Guest', 'text')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = now();
