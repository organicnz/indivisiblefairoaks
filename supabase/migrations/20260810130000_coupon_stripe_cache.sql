-- Cache the Stripe coupon id per promo code so checkout sessions reuse one
-- Stripe coupon instead of creating a new one on every purchase.
alter table coupons
  add column if not exists stripe_coupon_id text;
