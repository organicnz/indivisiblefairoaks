// Commerce constants for the Deno edge runtime.
//
// MIRRORS `src/config/commerce.ts`. The edge runtime cannot import from `src/`
// (different module root and resolver), so this is a deliberate second copy — and
// a second copy is exactly how the storefront ended up charging `nzd` with
// Auckland pickup addresses while the Next app and its JSON-LD advertised `USD`.
// The edge `checkout` function was the worse half: it created real Stripe
// sessions in New Zealand dollars, reachable directly by anyone who found the
// endpoint.
//
// `src/lib/__tests__/commerce-parity.test.ts` asserts the two agree, so drift
// fails CI rather than billing a customer.

export const CURRENCY = 'usd';
export const CURRENCY_CODE = 'USD';

export const SHIPPING_RATES = [
  {
    id: 'standard',
    name: 'Standard USPS tracked mail',
    amount: 800, // in cents
    currency: CURRENCY,
    displayPrice: '$8.00',
  },
  {
    id: 'local-pickup',
    name: 'Local pickup in Carmichael, CA',
    amount: 0,
    currency: CURRENCY,
    displayPrice: 'No cost',
    stripeDisplayName: 'Free — pickup in Carmichael, CA (by arrangement)',
  },
];

export function getStripeShippingOptions() {
  return SHIPPING_RATES.map((rate) => ({
    shipping_rate_data: {
      // `as const` is required: Stripe's types want the literal, and widening it to
      // `string` fails the session-create overload in checkout/index.ts.
      type: 'fixed_amount' as const,
      fixed_amount: { amount: rate.amount, currency: rate.currency },
      display_name: rate.stripeDisplayName || rate.name,
    },
  }));
}
