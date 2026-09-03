import { describe, expect, it } from 'vitest';
import { getStripeShippingOptions, SHIPPING_RATES } from '@/config/shipping';

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

  it('every rate uses nzd currency', () => {
    for (const rate of SHIPPING_RATES) {
      expect(rate.currency).toBe('nzd');
    }
  });

  it('amounts are in cents (integers)', () => {
    for (const rate of SHIPPING_RATES) {
      expect(Number.isInteger(rate.amount)).toBe(true);
    }
  });

  it('pickup rate has zero amount', () => {
    const pickup = SHIPPING_RATES.find((r) => r.id === 'pickup');
    expect(pickup?.amount).toBe(0);
  });

  it('standard rate is 800 cents ($8.00 NZD)', () => {
    const standard = SHIPPING_RATES.find((r) => r.id === 'standard');
    expect(standard?.amount).toBe(800);
  });

  it('rural rate is more expensive than standard', () => {
    const standard = SHIPPING_RATES.find((r) => r.id === 'standard');
    const rural = SHIPPING_RATES.find((r) => r.id === 'rural');
    expect(standard?.amount).toBeGreaterThanOrEqual(0);
    expect(rural?.amount).toBeGreaterThan(standard?.amount ?? 0);
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
      expect(options[i].shipping_rate_data.fixed_amount.currency).toBe(SHIPPING_RATES[i].currency);
    }
  });

  it('uses stripeDisplayName when present, falls back to name', () => {
    const pickup = SHIPPING_RATES.find((r) => r.id === 'pickup');
    expect(pickup).toBeDefined();
    if (!pickup) return;
    const options = getStripeShippingOptions();
    const pickupOpt = options[SHIPPING_RATES.indexOf(pickup)];
    // pickup has a stripeDisplayName
    expect(pickupOpt.shipping_rate_data.display_name).toBe(pickup.stripeDisplayName);
  });
});
