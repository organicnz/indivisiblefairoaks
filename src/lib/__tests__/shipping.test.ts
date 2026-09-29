import { describe, expect, it } from 'vitest';
import { CURRENCY, formatPrice, getStripeShippingOptions, SHIPPING_RATES } from '@/config/commerce';

// ─── SHIPPING_RATES data integrity ────────────────────────────────────────────
// Shipping rates are sent directly to Stripe. Wrong values = wrong charges.
describe('SHIPPING_RATES', () => {
  it('has at least one rate', () => {
    expect(SHIPPING_RATES.length).toBeGreaterThan(0);
  });

  it('every rate has a unique id', () => {
    const ids = SHIPPING_RATES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every rate has a non-negative amount', () => {
    for (const rate of SHIPPING_RATES) {
      expect(rate.amount).toBeGreaterThanOrEqual(0);
    }
  });

  it('every Stripe option is denominated in the storefront currency', () => {
    // Currency lives in exactly one place. A per-rate currency field is how the
    // checkout ended up charging 'nzd' while structured data advertised 'USD'.
    for (const rate of SHIPPING_RATES) {
      expect(rate).not.toHaveProperty('currency');
    }
    for (const opt of getStripeShippingOptions()) {
      expect(opt.shipping_rate_data.fixed_amount.currency).toBe(CURRENCY);
    }
  });

  it('amounts are in cents (integers)', () => {
    for (const rate of SHIPPING_RATES) {
      expect(Number.isInteger(rate.amount)).toBe(true);
    }
  });

  it('local pickup is free', () => {
    const pickup = SHIPPING_RATES.find((r) => r.id === 'local-pickup');
    expect(pickup?.amount).toBe(0);
  });

  it('every display price matches the amount it advertises', () => {
    // displayPrice is shown to the shopper next to the Stripe charge, so a stale
    // string here is a pricing lie.
    for (const rate of SHIPPING_RATES) {
      if (rate.amount === 0) {
        expect(rate.displayPrice).toMatch(/no cost|free/i);
        continue;
      }
      expect(rate.displayPrice).toBe(formatPrice(rate.amount / 100));
    }
  });
});

// ─── getStripeShippingOptions() ───────────────────────────────────────────────
describe('getStripeShippingOptions()', () => {
  it('returns one option per shipping rate', () => {
    const options = getStripeShippingOptions();
    expect(options.length).toBe(SHIPPING_RATES.length);
  });

  it('each option has the required Stripe shape', () => {
    for (const opt of getStripeShippingOptions()) {
      expect(opt).toHaveProperty('shipping_rate_data');
      expect(opt.shipping_rate_data).toHaveProperty('type', 'fixed_amount');
      expect(opt.shipping_rate_data).toHaveProperty('fixed_amount');
      expect(opt.shipping_rate_data).toHaveProperty('display_name');
      expect(typeof opt.shipping_rate_data.display_name).toBe('string');
      expect(opt.shipping_rate_data.display_name.length).toBeGreaterThan(0);
    }
  });

  it('amounts in Stripe options match SHIPPING_RATES', () => {
    const options = getStripeShippingOptions();
    for (let i = 0; i < SHIPPING_RATES.length; i++) {
      expect(options[i].shipping_rate_data.fixed_amount.amount).toBe(SHIPPING_RATES[i].amount);
      expect(options[i].shipping_rate_data.fixed_amount.currency).toBe(CURRENCY);
    }
  });

  it('uses stripeDisplayName when present, falls back to name', () => {
    const pickup = SHIPPING_RATES.find((r) => r.id === 'local-pickup');
    expect(pickup).toBeDefined();
    if (!pickup) return;
    const options = getStripeShippingOptions();
    const pickupOpt = options[SHIPPING_RATES.indexOf(pickup)];
    // pickup has a stripeDisplayName
    expect(pickupOpt.shipping_rate_data.display_name).toBe(pickup.stripeDisplayName);
  });
});
