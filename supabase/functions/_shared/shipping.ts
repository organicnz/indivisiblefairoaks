// ---------------------------------------------------------------------------
// Shared shipping catalog for edge functions.
//
// Mirrors `src/config/shipping.ts` (the Next.js source of truth). Duplicated
// intentionally: `supabase functions deploy` uploads only the function's own
// folder (+ `_shared`), so a relative import reaching into `../../../src/`
// breaks the remote bundle. Keep the two files in sync when rates change.
// ---------------------------------------------------------------------------

export const SHIPPING_RATES = [
  {
    id: 'standard',
    name: 'Standard (non-rural) tracked postage',
    amount: 800, // in cents
    currency: 'nzd',
    displayPrice: '$8.00',
  },
  {
    id: 'rural',
    name: 'Rural tracked postage',
    amount: 1400,
    currency: 'nzd',
    displayPrice: '$14.00',
  },
  {
    id: 'standard-courier',
    name: 'Standard (non-rural) tracked courier',
    amount: 1000,
    currency: 'nzd',
    displayPrice: '$10.00',
  },
  {
    id: 'rural-courier',
    name: 'Rural tracked courier',
    amount: 1500,
    currency: 'nzd',
    displayPrice: '$15.00',
  },
  {
    id: 'pickup',
    name: 'Pick-up by appointment (Chatswood, North Shore)',
    amount: 0,
    currency: 'nzd',
    displayPrice: 'No cost',
    stripeDisplayName: 'Pick-up by appointment from Chatswood (North Shore Auckland)',
  },
];

export function getStripeShippingOptions() {
  return SHIPPING_RATES.map((rate) => ({
    shipping_rate_data: {
      type: 'fixed_amount' as const,
      fixed_amount: { amount: rate.amount, currency: rate.currency },
      display_name:
        (rate as { stripeDisplayName?: string }).stripeDisplayName ?? rate.name,
    },
  }));
}
