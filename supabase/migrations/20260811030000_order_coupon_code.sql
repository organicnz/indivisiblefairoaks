-- Record which promo code was applied to an order so the admin Coupons
-- page can show real usage (times used + revenue generated per code).
alter table orders
  add column if not exists coupon_code text;