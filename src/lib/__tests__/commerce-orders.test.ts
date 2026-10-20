// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CURRENCY_CODE } from '@/config/commerce';
import {
  isOrderSource,
  mapStripeSessionToRow,
  mapWooOrderToRow,
  mapWooStatus,
  normalizeOrderCurrency,
  ORDER_SOURCES,
  type StripeSessionLike,
  type WooOrderLike,
} from '@/lib/commerce/orders';

describe('order provider seam', () => {
  describe('isOrderSource', () => {
    it('accepts exactly the constraint values', () => {
      expect(ORDER_SOURCES).toEqual(['stripe', 'woocommerce', 'manual']);
      for (const source of ORDER_SOURCES) expect(isOrderSource(source)).toBe(true);
    });

    it('rejects anything else', () => {
      for (const bad of ['shopify', 'STRIPE', '', null, undefined, 42]) {
        expect(isOrderSource(bad)).toBe(false);
      }
    });
  });

  describe('normalizeOrderCurrency', () => {
    it('uppercases a stored code', () => {
      expect(normalizeOrderCurrency('usd')).toBe('USD');
    });

    it('falls back to the storefront currency, never anything else', () => {
      for (const missing of [null, undefined, '', '   ']) {
        expect(normalizeOrderCurrency(missing)).toBe(CURRENCY_CODE);
      }
      expect(CURRENCY_CODE).toBe('USD');
    });
  });

  describe('mapStripeSessionToRow', () => {
    const session: StripeSessionLike = {
      id: 'cs_test_123',
      currency: 'usd',
      amount_total: 4250,
      customer_details: {
        email: 'jane@example.com',
        name: 'Jane Doe',
        phone: '(916) 555-0199',
        address: { line1: '123 Main St', city: 'Fair Oaks', country: 'US' },
      },
      shipping_details: null,
    };

    it('maps cents to dollars with the stripe source', () => {
      const row = mapStripeSessionToRow(session);
      expect(row.source).toBe('stripe');
      expect(row.external_id).toBeNull();
      expect(row.total).toBe(42.5);
      expect(row.currency).toBe('USD');
      expect(row.status).toBe('processing');
    });

    it('splits the buyer name onto the billing address', () => {
      const row = mapStripeSessionToRow(session);
      expect(row.billing_address).toMatchObject({
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
      });
    });

    it('keeps a guest email when no name was captured', () => {
      const row = mapStripeSessionToRow({
        ...session,
        customer_details: { ...session.customer_details, name: null },
      });
      expect(row.shipping_address).toMatchObject({ email: 'jane@example.com' });
    });

    it('treats a missing total and currency as zero and USD', () => {
      const row = mapStripeSessionToRow({ id: 'cs_test_empty' });
      expect(row.total).toBe(0);
      expect(row.currency).toBe('USD');
      expect(row.billing_address).toBeNull();
      expect(row.shipping_address).toBeNull();
    });
  });

  describe('mapWooStatus', () => {
    it('passes through the shared statuses', () => {
      for (const status of [
        'pending',
        'processing',
        'on-hold',
        'completed',
        'cancelled',
        'refunded',
      ]) {
        expect(mapWooStatus(status)).toBe(status);
      }
    });

    it('folds statuses with no local meaning into cancelled', () => {
      expect(mapWooStatus('failed')).toBe('cancelled');
      expect(mapWooStatus('trash')).toBe('cancelled');
    });

    it('defaults a missing status to pending', () => {
      expect(mapWooStatus(null)).toBe('pending');
      expect(mapWooStatus(undefined)).toBe('pending');
      expect(mapWooStatus('')).toBe('pending');
    });
  });

  describe('mapWooOrderToRow', () => {
    const wooOrder: WooOrderLike = {
      id: 1024,
      status: 'processing',
      currency: 'USD',
      total: '42.50',
      billing: {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        address_1: '123 Main St',
        city: 'Fair Oaks',
        postcode: '95628',
        country: 'US',
      },
      shipping: { address_1: '123 Main St', city: 'Fair Oaks', postcode: '95628' },
      line_items: [{ name: 'Yard sign', quantity: 2, total: '42.50' }],
    };

    it('identifies the row by the Woo order id', () => {
      const row = mapWooOrderToRow(wooOrder);
      expect(row.source).toBe('woocommerce');
      expect(row.external_id).toBe('1024');
      expect(row.total).toBe(42.5);
      expect(row.status).toBe('processing');
    });

    it('keeps Woo address keys verbatim for formatAddress', () => {
      const row = mapWooOrderToRow(wooOrder);
      expect(row.billing_address).toMatchObject({ address_1: '123 Main St', postcode: '95628' });
    });

    it('maps a non-numeric total to zero rather than NaN', () => {
      const row = mapWooOrderToRow({ ...wooOrder, total: 'refunded' });
      expect(row.total).toBe(0);
    });

    it('nulls absent addresses', () => {
      const row = mapWooOrderToRow({ id: 7, total: '5.00' });
      expect(row.billing_address).toBeNull();
      expect(row.shipping_address).toBeNull();
      expect(row.currency).toBe('USD');
    });
  });
});
