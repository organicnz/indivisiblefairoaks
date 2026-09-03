-- Guard against duplicate orders for the same Stripe session (webhook retries/races)
create unique index if not exists orders_stripe_session_id_key
  on orders (stripe_session_id)
  where stripe_session_id is not null;

-- Track the payment intent so refund/failure events can be matched to orders
alter table orders
  add column if not exists stripe_payment_intent_id text;

create index if not exists orders_stripe_payment_intent_id_key
  on orders (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;