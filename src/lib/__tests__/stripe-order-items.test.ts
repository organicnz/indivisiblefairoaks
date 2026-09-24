import type Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { buildOrderItems, type OrderItemRow } from '@/lib/stripe-order-items';

type LineItemOverrides = Partial<
  Pick<Stripe.LineItem, 'description' | 'quantity' | 'amount_total'>
> & {
  price?: {
    product?: {
      name?: string;
      metadata?: Record<string, string>;
    } | null;
  } | null;
};

function makeLineItem(overrides: LineItemOverrides = {}): Stripe.LineItem {
  return {
    id: 'li_1',
    object: 'line_item',
    description: overrides.description ?? null,
    quantity: overrides.quantity ?? 1,
    amount_total: overrides.amount_total ?? 4990,
    price: overrides.price
      ? ({
          product: overrides.price.product ?? null,
        } as unknown as Stripe.Price)
      : null,
  } as unknown as Stripe.LineItem;
}

describe('buildOrderItems()', () => {
  it('maps catalog id from product metadata (checkout stamps id since 2026-08)', () => {
    const items = buildOrderItems(7, [
      makeLineItem({
        quantity: 2,
        amount_total: 9980,
        price: { product: { name: '300m 10lb', metadata: { id: '46', slug: '300m-10lb' } } },
      }),
    ]);

    expect(items).toEqual<OrderItemRow[]>([
      {
        order_id: 7,
        product_id: 46,
        product_name: '300m 10lb',
        quantity: 2,
        unit_price: 49.9,
      },
    ]);
  });

  it('resolves null product_id for legacy sessions carrying only slug metadata', () => {
    const items = buildOrderItems(7, [
      makeLineItem({
        price: { product: { name: 'Legacy Rig', metadata: { slug: 'legacy-rig' } } },
      }),
    ]);

    expect(items[0].product_id).toBeNull();
    expect(items[0].product_name).toBe('Legacy Rig');
  });

  it('falls back to line item description when product expand is missing', () => {
    const items = buildOrderItems(3, [
      makeLineItem({ description: 'Shipping (NZ Courier)', price: null }),
    ]);

    expect(items[0]).toMatchObject({
      order_id: 3,
      product_id: null,
      product_name: 'Shipping (NZ Courier)',
    });
  });

  it('never produces NaN ids from malformed metadata', () => {
    const items = buildOrderItems(1, [
      makeLineItem({ price: { product: { name: 'X', metadata: { id: 'not-a-number' } } } }),
    ]);

    expect(items[0].product_id).toBeNull();
  });

  it('defaults quantity to 1 and converts cents to dollars', () => {
    const items = buildOrderItems(9, [
      makeLineItem({
        amount_total: 2500,
        price: { product: { name: 'Hooks', metadata: { id: '12' } } },
      }),
    ]);

    expect(items[0].quantity).toBe(1);
    expect(items[0].unit_price).toBe(25);
  });
});
