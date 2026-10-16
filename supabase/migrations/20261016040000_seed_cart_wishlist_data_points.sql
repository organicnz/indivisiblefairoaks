-- ==============================================================================
-- Migration: 20261016040000_seed_cart_wishlist_data_points.sql
-- Description: Seeds order summary, shipping estimates, checkout notes,
--              and wishlist item actions into public.data_points.
-- ==============================================================================

INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('cart.summary.heading', 'cart', 'Order Summary Heading', 'Order Summary', 'text'),
  ('cart.summary.subtotal', 'cart', 'Subtotal Label', 'Subtotal', 'text'),
  ('cart.summary.shipping_label', 'cart', 'Shipping Estimate Label', 'Shipping estimate', 'text'),
  ('cart.summary.shipping_note', 'cart', 'Shipping Note', 'Calculated at checkout', 'text'),
  ('cart.summary.total_label', 'cart', 'Order Total Label', 'Order total', 'text'),
  ('cart.summary.express_label', 'cart', 'Express Checkout Label', 'Express Checkout', 'text'),
  ('cart.summary.secure_label', 'cart', 'Secure Checkout Label', 'Secure Checkout Guaranteed', 'text'),
  ('wishlist.btn.move_to_cart', 'wishlist', 'Move to Cart Button', 'Move to Cart', 'text'),
  ('wishlist.btn.remove', 'wishlist', 'Remove Button', 'Remove', 'text')
ON CONFLICT (key) DO UPDATE
SET
  label = EXCLUDED.label,
  value = EXCLUDED.value,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = now();
