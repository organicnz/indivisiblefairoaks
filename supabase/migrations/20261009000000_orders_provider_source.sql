-- Orders provider seam for a future WooCommerce store.
--
-- There are no live orders: any rows present are residue from the
-- pre-refactor site, and `currency` already defaults to 'usd' in the canonical
-- schema. This migration only records *where* an order came from, so that a
-- future store integration writes into the same table rather than a second one.
--
-- When a WooCommerce store is linked, its adapter writes `source =
-- 'woocommerce'` with the Woo order id in `external_id`, through
-- `mapWooOrderToRow()` in `src/lib/commerce/orders.ts`. Stripe rows keep
-- `source = 'stripe'` and identify by `stripe_session_id` as before. The CHECK
-- and the mapper land in the same change, so a new provider value can never be
-- written that the constraint refuses — the `crm_broadcasts.status` omission
-- of `'queued'` is the failure being avoided here.
--
-- Reads do not select these columns until this migration has been pushed to the
-- hosted project: PostgREST refuses a select naming an unknown column, so the
-- admin queries keep their current column lists and the hand-written order
-- types carry `source`/`external_id` as optional until then.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_source_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_source_check CHECK (source IN ('stripe', 'woocommerce', 'manual'));

CREATE INDEX IF NOT EXISTS orders_external_id_idx
  ON public.orders (source, external_id)
  WHERE external_id IS NOT NULL;

COMMENT ON COLUMN public.orders.source IS 'Origin of the order: stripe, woocommerce, or manual. Pre-existing rows default to stripe.';
COMMENT ON COLUMN public.orders.external_id IS 'Provider-side id (WooCommerce order id). Stripe rows use stripe_session_id instead and leave this NULL.';
