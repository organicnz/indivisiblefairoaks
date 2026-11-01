// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatPrice, SHIPPING_RATES } from '@/config/commerce';

// ─── SHIPPING_RATES data integrity ────────────────────────────────────────────
// These rates are public pricing claims: they render on /shipping-returns and
// are published as the Product JSON-LD `shippingDetails`. Wrong values are a
// pricing lie even though there is no checkout to charge them.
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
    for (const rate of SHIPPING_RATES) {
      if (rate.amount === 0) {
        expect(rate.displayPrice).toMatch(/no cost|free/i);
        continue;
      }
      expect(rate.displayPrice).toBe(formatPrice(rate.amount / 100));
    }
  });
});
