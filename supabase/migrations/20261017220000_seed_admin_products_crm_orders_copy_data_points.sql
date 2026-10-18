-- Seed the admin products, CRM and orders screen copy into data_points.
--
-- Wave B of the "every user-visible string resolves from data_points" sweep,
-- following the dashboard (20261017203000) and coupons/customers
-- (20261017210000) waves.
--
-- Every value below is the string the screen renders today, so wiring each with
-- `dataPoints[key] || '<value>'` (or a DataPoint whose child is that string)
-- keeps SSR output identical whichever side wins, and the data-points guard
-- asserts the fallback agrees with the seed.
--
-- Deliberately NOT seeded: form placeholders, pagination micro-labels
-- ("Prev", "Next", "Page X of Y"), the raw WooCommerce status codes in the
-- filter pills and stat cards (data values, not copy), and the dynamic
-- "Qty:" fragment. The deeper client components (CouponCreator, CRMContactList,
-- BulkStockActions, OrderStatusSelect, OrdersExport, …) are a separate wave.

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  -- Products
  ('admin.products.all_label', 'admin', 'Products Filter All Label', 'All', 'text'),
  ('admin.products.empty_none', 'admin', 'Products Empty State', 'No products found.', 'text'),
  ('admin.products.empty_filtered', 'admin', 'Products Filtered Empty State', 'No products match the filter.', 'text'),
  ('admin.products.on_sale_badge', 'admin', 'Products On Sale Badge', 'On sale', 'text'),
  ('admin.products.uncategorised', 'admin', 'Products Uncategorised Fallback', 'Uncategorised', 'text'),
  ('admin.products.stock_in', 'admin', 'Products In Stock Label', 'In stock', 'text'),
  ('admin.products.stock_out', 'admin', 'Products Out Of Stock Label', 'Out of stock', 'text'),
  ('admin.products.stock_backorder', 'admin', 'Products Backorder Label', 'On backorder', 'text'),
  -- CRM
  ('admin.crm.eyebrow', 'admin', 'CRM Panel Eyebrow', 'Admin Panel · Grassroots CRM', 'text'),
  ('admin.crm.kpi_contacts', 'admin', 'CRM Total Constituents Metric', 'Total Constituents', 'text'),
  ('admin.crm.kpi_volunteers', 'admin', 'CRM Volunteers Metric', 'Volunteers & Organizers', 'text'),
  ('admin.crm.kpi_district', 'admin', 'CRM District Metric', 'CA-06 / CA-03 Grassroots', 'text'),
  ('admin.crm.kpi_donors', 'admin', 'CRM Donors Metric', 'Grassroots Donors', 'text'),
  ('admin.crm.db_label', 'admin', 'CRM Database Status Label', 'Postgres DB', 'text'),
  ('admin.crm.storage_label', 'admin', 'CRM Storage Status Label', 'Supabase S3 Media', 'text'),
  ('admin.crm.sender_label', 'admin', 'CRM Sender Status Label', 'Edge Sender', 'text'),
  ('admin.crm.followups_label', 'admin', 'CRM Follow-ups Button', 'Follow-ups', 'text'),
  -- Orders
  ('admin.orders.h1', 'admin', 'Orders Title', 'Orders', 'text'),
  ('admin.orders.kpi_total', 'admin', 'Orders Total Metric', 'Total Orders', 'text'),
  ('admin.orders.kpi_processing', 'admin', 'Orders Processing Metric', 'Processing', 'text'),
  ('admin.orders.kpi_completed', 'admin', 'Orders Completed Metric', 'Completed', 'text'),
  ('admin.orders.kpi_revenue', 'admin', 'Orders Revenue Metric', 'Total Revenue', 'text'),
  ('admin.orders.range_all_time', 'admin', 'Orders Range All Time', 'All time', 'text'),
  ('admin.orders.empty_none', 'admin', 'Orders Empty State', 'No orders yet.', 'text'),
  ('admin.orders.empty_filtered', 'admin', 'Orders Filtered Empty State', 'No orders match the filter.', 'text'),
  ('admin.orders.empty_hint', 'admin', 'Orders Empty Hint', 'Orders will appear here once a store is connected.', 'text'),
  ('admin.orders.guest', 'admin', 'Orders Guest Fallback', 'Guest', 'text'),
  ('admin.orders.col_order', 'admin', 'Orders Order Column', 'Order', 'text'),
  ('admin.orders.col_customer', 'admin', 'Orders Customer Column', 'Customer', 'text'),
  ('admin.orders.col_ship_to', 'admin', 'Orders Ship To Column', 'Ship To', 'text'),
  ('admin.orders.col_total', 'admin', 'Orders Total Column', 'Total', 'text'),
  ('admin.orders.stripe_link', 'admin', 'Orders Stripe Link', 'Stripe', 'text')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = now();
