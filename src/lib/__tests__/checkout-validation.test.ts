import { describe, expect, it } from 'vitest';
import { validateCartItems, validatePromoCode } from '@/lib/checkout-validation';

describe('validateCartItems()', () => {
  it('accepts a well-formed cart', () => {
    const result = validateCartItems([{ id: 16, quantity: 2 }]);
    expect(result).toEqual({ ok: true, items: [{ id: 16, quantity: 2 }] });
  });

  it('rejects an empty or missing cart', () => {
    expect(validateCartItems([]).ok).toBe(false);
    expect(validateCartItems(undefined).ok).toBe(false);
    expect(validateCartItems('nope').ok).toBe(false);
  });

  it('rejects non-numeric and non-integer ids', () => {
    for (const bad of [
      { id: 'x', quantity: 1 },
      { id: 1.5, quantity: 1 },
    ]) {
      const r = validateCartItems([bad]);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.failure.message).toBe('Invalid item: id must be a number');
    }
  });

  it('rejects quantities outside 1–999 including floats', () => {
    for (const qty of [0, -3, 1000, 1.5]) {
      const r = validateCartItems([{ id: 16, quantity: qty }]);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.failure.field).toBe('items.16');
        expect(r.failure.message).toContain('between 1 and 999');
      }
    }
  });
});

describe('validatePromoCode()', () => {
  it('passes when absent', () => {
    expect(validatePromoCode(undefined)).toEqual({ ok: true });
  });

  it('treats empty and whitespace-only strings as "no promo" (cart always sends the field)', () => {
    expect(validatePromoCode('')).toEqual({ ok: true });
    expect(validatePromoCode('   ')).toEqual({ ok: true });
  });

  it('rejects non-strings and oversized codes', () => {
    expect(validatePromoCode(42).ok).toBe(false);
    expect(validatePromoCode('x'.repeat(51)).ok).toBe(false);
    expect(validatePromoCode('SAVE10').ok).toBe(true);
  });
});
