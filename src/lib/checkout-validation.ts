/**
 * Pure checkout-input validation shared by the API route.
 * Kept mock-free so vitest AND `bun test` can exercise every branch.
 */

export interface CartItemInput {
  id: number;
  quantity: number;
}

export type ValidationFailure = { field: string; message: string };

export function validateCartItems(
  raw: unknown
): { ok: true; items: CartItemInput[] } | { ok: false; failure: ValidationFailure } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, failure: { field: 'items', message: 'No items in cart' } };
  }

  const items: CartItemInput[] = [];
  for (const entry of raw) {
    const candidate = entry as { id?: unknown; quantity?: unknown };

    if (typeof candidate?.id !== 'number' || !Number.isInteger(candidate.id)) {
      return {
        ok: false,
        failure: { field: 'items', message: 'Invalid item: id must be a number' },
      };
    }

    if (
      typeof candidate?.quantity !== 'number' ||
      !Number.isInteger(candidate.quantity) ||
      candidate.quantity < 1 ||
      candidate.quantity > 999
    ) {
      return {
        ok: false,
        failure: {
          field: `items.${candidate.id}`,
          message: 'Invalid item: quantity must be an integer between 1 and 999',
        },
      };
    }

    items.push({ id: candidate.id, quantity: candidate.quantity });
  }

  return { ok: true, items };
}

export function validatePromoCode(
  raw: unknown
): { ok: true } | { ok: false; failure: ValidationFailure } {
  if (raw === undefined) return { ok: true };
  if (typeof raw !== 'string') {
    return { ok: false, failure: { field: 'promoCode', message: 'Invalid promo code' } };
  }
  // The cart always sends the field; empty means "no promo applied".
  if (raw.trim().length === 0) return { ok: true };
  if (raw.length > 50) {
    return { ok: false, failure: { field: 'promoCode', message: 'Invalid promo code' } };
  }
  return { ok: true };
}
