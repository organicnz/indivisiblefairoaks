-- Idempotent Stripe webhook processing: one order per checkout session.
-- Stripe retries deliveries (network failures, our 500s) and can emit
-- duplicate events; without this constraint each retry inserted another
-- orders row for the same session.

CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_session_id_key
  ON public.orders (stripe_session_id);
