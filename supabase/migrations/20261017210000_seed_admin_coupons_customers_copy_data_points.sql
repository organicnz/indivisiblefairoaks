-- Seed the admin coupons and customers screen copy into data_points.
--
-- Wave A of the "every user-visible string resolves from data_points" sweep.
-- The dashboard wave (20261017203000) established the pattern; this covers the
-- two screens whose copy was otherwise entirely hardcoded.
--
-- Every value below is the string the screen renders today, so wiring each with
-- `dataPoints[key] || '<value>'` (or a DataPoint whose child is that string)
-- keeps SSR output identical whichever side wins, and the data-points guard
-- asserts the fallback agrees with the seed.
--
-- Deliberately NOT seeded: form placeholders ("Search customers…"), micro-labels
-- ("N/A", "—"), and dynamic fragments, which are below the copy bar the earlier
-- waves set. The products and CRM/orders screens follow in later waves.

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  -- Coupons
  ('admin.coupons.discount_label', 'admin', 'Coupons Discount Column', 'Discount', 'text'),
  ('admin.coupons.expiry_label', 'admin', 'Coupons Expiry Column', 'Expiry', 'text'),
  ('admin.coupons.expiry_never', 'admin', 'Coupons Expiry Fallback', 'Never', 'text'),
  ('admin.coupons.used_label', 'admin', 'Coupons Used Column', 'Used', 'text'),
  ('admin.coupons.revenue_label', 'admin', 'Coupons Revenue Column', 'Order revenue', 'text'),
  ('admin.coupons.expired_badge', 'admin', 'Coupons Expired Badge', 'Expired', 'text'),
  -- Customers
  ('admin.customers.empty', 'admin', 'Customers Empty State', 'No customers yet.', 'text'),
  ('admin.customers.guest', 'admin', 'Customers Guest Fallback', 'Guest', 'text'),
  ('admin.customers.admin_badge', 'admin', 'Customers Admin Badge', 'Admin', 'text'),
  ('admin.customers.joined_label', 'admin', 'Customers Joined Column', 'Joined', 'text'),
  ('admin.customers.orders_label', 'admin', 'Customers Orders Column', 'Orders', 'text'),
  ('admin.customers.spend_label', 'admin', 'Customers Spend Column', 'Lifetime Spend', 'text'),
  ('admin.customers.last_order_label', 'admin', 'Customers Last Order Column', 'Last Order', 'text'),
  ('admin.customers.never_ordered', 'admin', 'Customers Never Ordered', 'Never ordered', 'text')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = now();
