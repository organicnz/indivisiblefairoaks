// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildCheckoutItems,
  validateCartItems,
  validatePromoCode,
} from '@/lib/checkout-validation';

describe('validateCartItems()', () => {
  it('accepts a well-formed cart', () => {
    const result = validateCartItems([{ id: 16, quantity: 2 }]);
    expect(result).toEqual({ ok: true, items: [{ id: 16, quantity: 2 }] });
  });

  it('accepts a product variation while keeping the product id separate', () => {
    const result = validateCartItems([{ id: 16, variationId: 4, quantity: 2 }]);
    expect(result).toEqual({ ok: true, items: [{ id: 16, variationId: 4, quantity: 2 }] });
  });

  it('rejects invalid variation ids', () => {
    expect(validateCartItems([{ id: 16, variationId: 0, quantity: 1 }]).ok).toBe(false);
    expect(validateCartItems([{ id: 16, variationId: 1.5, quantity: 1 }]).ok).toBe(false);
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

describe('buildCheckoutItems()', () => {
  // AddToCartButton writes `variationId: selectedVariation?.id ?? null`, so a
  // plain product line carries null. validateCartItems accepts only a positive
  // integer or `undefined` — null is a hard 400. This conversion is the reason
  // the mapping is shared instead of hand-inlined at two call sites.
  it('converts the store null to undefined, which is what the server accepts', () => {
    const built = buildCheckoutItems([{ id: 16, productId: 16, variationId: null, quantity: 2 }]);

    expect(built).toEqual([{ id: 16, variationId: undefined, quantity: 2 }]);
    expect(validateCartItems(built).ok).toBe(true);

    // The same cart line without the conversion is rejected outright, which is
    // the failure the shared builder exists to prevent.
    expect(validateCartItems([{ id: 16, variationId: null, quantity: 2 }]).ok).toBe(false);
  });

  it('keeps a selected variation id intact', () => {
    const built = buildCheckoutItems([{ id: 16, productId: 16, variationId: 7, quantity: 1 }]);
    expect(built).toEqual([{ id: 16, variationId: 7, quantity: 1 }]);
    expect(validateCartItems(built).ok).toBe(true);
  });

  it('names the product by productId, falling back to id — as sameLine() does', () => {
    // store/cart.ts resolves line identity as `productId ?? id`. The payload
    // has to name the same product the cart merged duplicate lines against.
    expect(buildCheckoutItems([{ id: 3, productId: 16, quantity: 1 }])[0]?.id).toBe(16);
    expect(buildCheckoutItems([{ id: 16, quantity: 1 }])[0]?.id).toBe(16);
  });

  it('is the only mapping the two checkout call sites use', () => {
    // The cart button and StripeExpressCheckout used to each inline this shape.
    // Pinning the output shape keeps a future edit to one from drifting the
    // other, since both now go through this function.
    expect(buildCheckoutItems([{ id: 5, quantity: 3 }])).toEqual([
      { id: 5, variationId: undefined, quantity: 3 },
    ]);
  });
});
