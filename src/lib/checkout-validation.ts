/**
 * Pure checkout-input validation shared by the API route.
 * Kept mock-free so vitest AND `bun test` can exercise every branch.
 */

export interface CartItemInput {
  id: number;
  variationId?: number;
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
    const candidate = entry as { id?: unknown; variationId?: unknown; quantity?: unknown };

    if (typeof candidate?.id !== 'number' || !Number.isInteger(candidate.id)) {
      return {
        ok: false,
        failure: { field: 'items', message: 'Invalid item: id must be a number' },
      };
    }

    if (
      candidate.variationId !== undefined &&
      (typeof candidate.variationId !== 'number' ||
        !Number.isInteger(candidate.variationId) ||
        candidate.variationId <= 0)
    ) {
      return {
        ok: false,
        failure: {
          field: 'items',
          message: 'Invalid item: variationId must be a positive integer',
        },
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

    items.push({
      id: candidate.id,
      ...(candidate.variationId === undefined ? {} : { variationId: candidate.variationId }),
      quantity: candidate.quantity,
    });
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

/**
 * Build the checkout wire payload from the client's cart store.
 *
 * Two call sites POST to `/api/checkout` — the cart page's button and
 * `StripeExpressCheckout` — and both previously inlined this six-line mapping.
 * Hand-copied shape between two sites is how this storefront shipped `nzd`
 * checkout alongside `USD` structured data once already (see
 * `config/commerce.ts`), so the mapping now lives beside the `CartItemInput`
 * type its output is validated against.
 *
 * Two details are worth stating, because neither is visible at the call site:
 *
 * - `variationId ?? undefined` — the store carries `number | null`
 *   (`AddToCartButton` writes `selectedVariation?.id ?? null`), while
 *   `validateCartItems` accepts only a positive integer or `undefined`. A null
 *   reaching it turns a normal checkout into a 400 reading "Invalid item:
 *   variationId must be a positive integer". This one is load-bearing.
 * - `productId ?? item.id` mirrors the store's own line identity: `sameLine()`
 *   in `store/cart.ts` resolves it exactly this way, so the payload names the
 *   same product the cart just used to merge duplicate lines. `productId` is
 *   optional on `CartItem` and `id` is its fallback, and today
 *   `AddToCartButton` sets both to the product id — so the ordering is
 *   defensive rather than load-bearing, but it must not be inverted, which
 *   would make `productId` dead and change the lookup for any future writer
 *   that sets the two differently.
 */
export function buildCheckoutItems(
  items: ReadonlyArray<{
    id: number;
    productId?: number;
    variationId?: number | null;
    quantity: number;
  }>
): CartItemInput[] {
  return items.map((item) => ({
    id: item.productId ?? item.id,
    variationId: item.variationId ?? undefined,
    quantity: item.quantity,
  }));
}
