import type Stripe from 'stripe';
import type { OrderItem } from '@/types/orders';

/**
 * Write shape for `order_items` inserts from Stripe.
 *
 * `OrderItem` (canonical, `src/types/orders.ts`) is the nullable read shape —
 * PostgREST returns nulls for missing columns. The webhook *writes* complete
 * rows, so this type narrows the three nullable columns to required and adds
 * the FK columns the read shape omits. A field added to one and not the other
 * is how fulfillment silently stops seeing product names.
 */
export interface OrderItemRow
  extends Required<Pick<OrderItem, 'product_name' | 'quantity' | 'unit_price'>> {
  order_id: number;
  product_id: number | null;
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
      unit_price: (item.amount_total || 0) / 100 / (item.quantity || 1),
    };
  });
}
