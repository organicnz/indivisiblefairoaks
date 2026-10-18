-- Seed the admin client-component copy into data_points.
--
-- Wave C of the "every user-visible string resolves from data_points" sweep,
-- after the dashboard (20261017203000), coupons/customers (20261017210000)
-- and products/CRM/orders (20261017220000) waves covered the server pages.
-- This covers the interactive client components that render the coupon editor,
-- the product editor, the bulk-action bars, the customer admin toggle and the
-- orders export button.
--
-- Client components read through `useDataPoints('admin')` and render
-- `dataPoints[key] || '<value>'`, so every value below is the string the
-- component renders today and the data-points guard asserts the two agree.
--
-- Generic action chrome that repeats across components (Edit/Save/Cancel/
-- Delete/Apply/Clear/Select all) is seeded once under `admin.ui.*` rather than
-- once per surface. Stock labels reuse the `admin.products.stock_*` keys the
-- products wave already seeded.
--
-- Deliberately NOT seeded: form placeholders, validation/error fallbacks,
-- dynamic fragments ("Edit {code}", "{n} selected", "Mark {status}"), derived
-- status labels, CSV export headers, and the accessibility `aria-label`s on the
-- per-row checkboxes. CRMContactList (1,594 lines) is a further wave.

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  -- Coupon editor (CouponCreator + CouponEditor)
  ('admin.coupons.form_code', 'admin', 'Coupon Code Field Label', 'Code', 'text'),
  ('admin.coupons.form_type', 'admin', 'Coupon Type Field Label', 'Type', 'text'),
  ('admin.coupons.form_percent', 'admin', 'Coupon Percent Option', 'Percent %', 'text'),
  ('admin.coupons.form_fixed', 'admin', 'Coupon Fixed Option', 'Fixed $', 'text'),
  ('admin.coupons.form_percent_off', 'admin', 'Coupon Percent Off Label', 'Percent off', 'text'),
  ('admin.coupons.form_dollar_off', 'admin', 'Coupon Dollar Off Label', 'Dollar off', 'text'),
  ('admin.coupons.form_expires', 'admin', 'Coupon Expires Field Label', 'Expires', 'text'),
  ('admin.coupons.form_create', 'admin', 'Coupon Create Button', 'Create', 'text'),
  ('admin.coupons.created', 'admin', 'Coupon Created Message', 'Coupon created.', 'text'),
  -- Product editor
  ('admin.products.price_label', 'admin', 'Product Price Field Label', 'Price', 'text'),
  ('admin.products.compare_at_label', 'admin', 'Product Compare-At Field Label', 'Compare-at', 'text'),
  -- Customers
  ('admin.customers.admin_access', 'admin', 'Customer Admin Access Label', 'Admin access', 'text'),
  ('admin.customers.promote', 'admin', 'Customer Promote Button', 'Promote to admin', 'text'),
  -- Orders
  ('admin.orders.export_csv', 'admin', 'Orders Export Button', 'Export CSV', 'text'),
  -- Shared generic action chrome
  ('admin.ui.edit', 'admin', 'Edit Button', 'Edit', 'text'),
  ('admin.ui.save', 'admin', 'Save Button', 'Save', 'text'),
  ('admin.ui.cancel', 'admin', 'Cancel Button', 'Cancel', 'text'),
  ('admin.ui.delete', 'admin', 'Delete Button', 'Delete', 'text'),
  ('admin.ui.apply', 'admin', 'Bulk Apply Button', 'Apply', 'text'),
  ('admin.ui.clear', 'admin', 'Bulk Clear Button', 'Clear', 'text'),
  ('admin.ui.select_all', 'admin', 'Bulk Select All', 'Select all', 'text')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = now();
