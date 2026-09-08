import type Stripe from 'stripe';

export interface OrderItemRow {
  order_id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
}

/**
 * Maps Stripe checkout line items to order_items rows.
 *
 * The webhook reads `product.metadata.id`, which the checkout route stamps
 * from the catalog (`id: String(dbProduct.id)`). Sessions created before that
 * field existed carry only `slug` — those resolve to a null product_id and
 * keep the human-readable name for fulfillment.
 */
export function buildOrderItems(orderId: number, lineItems: Stripe.LineItem[]): OrderItemRow[] {
  return lineItems.map((item: Stripe.LineItem) => {
    const product = item.price?.product as Stripe.Product | undefined;
    const metaId = product?.metadata?.id;

    return {
      order_id: orderId,
      product_id:
        typeof metaId === 'string' && /^\d+$/.test(metaId) ? Number.parseInt(metaId, 10) : null,
      product_name: product?.name || item.description || 'Unknown product',
      quantity: item.quantity || 1,
      unit_price: (item.amount_total || 0) / 100,
    };
  });
}
