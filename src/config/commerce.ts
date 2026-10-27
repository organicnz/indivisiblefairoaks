// Single source of truth for commerce currency and shipping.
//
// This module exists because the storefront had **two** currencies in it at once:
// the Stripe checkout sessions were created in `nzd` with Auckland pickup addresses
// carried over from an earlier client, while the Product JSON-LD declared
// `priceCurrency: 'USD'`. Search engines compare structured data against the
// checkout a user actually reaches, and that mismatch is grounds for a Merchant
// Center disapproval — on top of simply being wrong: this chapter is a California
// 501(c)(3)-adjacent nonprofit, not a New Zealand retailer.
//
// Every currency literal now reads from here. If the chapter ever ships
// internationally, this is the only file that changes.

export const CURRENCY = 'usd';
export const CURRENCY_CODE = 'USD';

/**
 * Feature toggle for the legacy order management experience.
 *
 * Preserves the entire legacy order stack (admin views, CSV export, customer order
 * history, status updates) while keeping it hidden from navigation and account tabs.
 *
 * To bring the full order experience back to life in the UI:
 * Flip `ENABLE_LEGACY_ORDERS` to `true`.
 */
export const ENABLE_LEGACY_ORDERS = false;

/** Symbol formatter for the storefront. Single implementation, no per-site copies. */
export function formatPrice(amount: number | string | null | undefined): string {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: CURRENCY_CODE,
  }).format(Number.isFinite(value) ? value : 0);
}

export type ShippingRate = {
  id: string;
  name: string;
  /** Minor units (cents). */
  amount: number;
  displayPrice: string;
  stripeDisplayName?: string;
};

/**
 * Domestic US shipping for meetups and mailings.
 *
 * NOTE FOR THE CHAPTER: these rates are placeholders carried over from the previous
 * site's New Zealand tariff. Confirm the real figures — they are a business
 * decision, not an engineering one. Everything else in the checkout path
 * (Stripe session currency, TaxJar/tax handling, JSON-LD `priceCurrency`, the
 * `/shipping-returns` copy) already reads from this module, so changing a number
 * here is the whole edit.
 */
export const SHIPPING_RATES: readonly ShippingRate[] = [
  {
    id: 'standard',
    name: 'Standard USPS tracked mail',
    amount: 800,
    displayPrice: '$8.00',
  },
  {
    id: 'local-pickup',
    name: 'Local pickup in Carmichael, CA',
    amount: 0,
    displayPrice: 'No cost',
    stripeDisplayName: 'Free — pickup in Carmichael, CA (by arrangement)',
  },
] as const;

export function getStripeShippingOptions() {
  return SHIPPING_RATES.map((rate) => ({
    shipping_rate_data: {
      type: 'fixed_amount' as const,
      fixed_amount: { amount: rate.amount, currency: CURRENCY },
      display_name: rate.stripeDisplayName || rate.name,
    },
  }));
}

/** Where a shopper can collect an order. */
export const PICKUP_NOTE =
  'Orders can be collected in Carmichael, CA by arrangement — allow a few days so we can confirm a time.';

/** Handling time surfaced on the PDP and in the shipping policy. */
export const FULFILMENT_WINDOW = '2–5 business days after payment.';
