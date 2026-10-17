-- Seed cart toast messages into public.data_points
INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('cart.toast.sold_out', 'cart', 'Cart Item Sold Out Notice', 'An item sold out and was removed from your cart.', 'text'),
  ('cart.toast.checkout_error', 'cart', 'Cart Checkout Error Message', 'Something went wrong starting checkout.', 'text'),
  ('cart.toast.connection_error', 'cart', 'Cart Connection Error Message', 'Checkout failed — check your connection and try again.', 'text')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  updated_at = NOW();
