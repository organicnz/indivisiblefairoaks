// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CURRENCY as APP_CURRENCY,
  CURRENCY_CODE as APP_CURRENCY_CODE,
  SHIPPING_RATES as APP_RATES,
  getStripeShippingOptions as appShippingOptions,
  formatPrice,
} from '@/config/commerce';
import {
  CURRENCY as EDGE_CURRENCY,
  CURRENCY_CODE as EDGE_CURRENCY_CODE,
  SHIPPING_RATES as EDGE_RATES,
  getStripeShippingOptions as edgeShippingOptions,
} from '../../../supabase/functions/_shared/commerce';

/**
 * The edge runtime cannot import from `src/` — different module root and
 * resolver — so `supabase/functions/_shared/commerce.ts` is a deliberate second
 * copy of the storefront's commerce config.
 *
 * That duplication is not hypothetical. The two copies had already diverged: the
 * Next app and its Product JSON-LD advertised `USD`, while the edge `checkout`
 * function created real Stripe sessions in `nzd` with a New Zealand shipping
 * tariff and `allowed_countries: ['NZ']`. The Next app fixed its half; the edge
 * half kept charging in dollars nobody here uses, and was reachable directly by
 * anyone who found the endpoint.
 *
 * These tests make divergence a build failure.
 */
describe('commerce parity: edge runtime vs storefront', () => {
  it('agrees on the currency', () => {
    expect(EDGE_CURRENCY).toBe(APP_CURRENCY);
    expect(EDGE_CURRENCY_CODE).toBe(APP_CURRENCY_CODE);
  });

  it('is not New Zealand dollars', () => {
    // Spelled out rather than derived, so the intent survives a refactor.
    expect(APP_CURRENCY).toBe('usd');
    expect(EDGE_CURRENCY).not.toBe('nzd');
  });

  it('ships the same rate ids in the same order', () => {
    expect(EDGE_RATES.map((r) => r.id)).toEqual(APP_RATES.map((r) => r.id));
  });

  it('charges the same amounts for the same rates', () => {
    const edgeById = new Map(EDGE_RATES.map((r) => [r.id, r.amount]));
    for (const rate of APP_RATES) {
      expect(edgeById.get(rate.id), `rate "${rate.id}" amount`).toBe(rate.amount);
    }
  });

  it('produces byte-identical Stripe shipping options', () => {
    // The payoff: a cart priced on the storefront and settled by the edge function
    // cannot disagree about postage.
    expect(JSON.stringify(edgeShippingOptions())).toBe(JSON.stringify(appShippingOptions()));
  });

  it('denominates every edge shipping option in the storefront currency', () => {
    for (const option of edgeShippingOptions()) {
      expect(option.shipping_rate_data.fixed_amount.currency).toBe(APP_CURRENCY);
    }
  });

  it('advertises prices that match the amounts charged', () => {
    for (const rate of APP_RATES) {
      if (rate.amount === 0) {
        expect(rate.displayPrice).toMatch(/no cost|free/i);
        continue;
      }
      expect(rate.displayPrice).toBe(formatPrice(rate.amount / 100));
    }
  });
});
