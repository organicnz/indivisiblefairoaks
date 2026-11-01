// Single source of truth for the catalog's currency and shipping display.
//
// This module exists because the storefront had **two** currencies in it at once:
// the (since removed) Stripe checkout created sessions in `nzd` with Auckland
// pickup addresses carried over from an earlier client, while the Product JSON-LD
// declared `priceCurrency: 'USD'`. Search engines compare structured data against
// the purchase path a user actually reaches, and that mismatch is grounds for a
// Merchant Center disapproval — on top of simply being wrong: this chapter is a
// California 501(c)(3)-adjacent nonprofit, not a New Zealand retailer.
//
// Every currency literal now reads from here. If the chapter ever ships
// internationally, this is the only file that changes.

export const CURRENCY_CODE = 'USD';

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
};

/**
 * Domestic US shipping for meetups and mailings.
 *
 * NOTE FOR THE CHAPTER: these rates are placeholders carried over from the previous
 * site's New Zealand tariff. Confirm the real figures — they are a business
 * decision, not an engineering one. The Policy page and the Product JSON-LD
 * `shippingDetails` both read from this module, so changing a number here is the
 * whole edit.
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
  },
] as const;

/** Where a shopper can collect a product. */
export const PICKUP_NOTE =
  'Products can be collected in Carmichael, CA by arrangement — allow a few days so we can confirm a time.';

/** Handling time surfaced on the PDP and in the shipping policy. */
export const FULFILMENT_WINDOW = '2–5 business days after payment.';
