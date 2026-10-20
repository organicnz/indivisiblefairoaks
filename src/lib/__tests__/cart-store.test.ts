// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import './localstorage-shim';
import { MAX_ITEM_QUANTITY, useCartStore } from '@/lib/store/cart';

const reset = () => useCartStore.setState({ items: [] });

const item = (id: number, quantity = 1) => ({
  id,
  name: `Product ${id}`,
  price: 100,
  quantity,
  image_url: null,
  slug: `product-${id}`,
});

describe('useCartStore clamps', () => {
  beforeEach(reset);

  it('addItem caps quantity at MAX_ITEM_QUANTITY for existing lines', () => {
    useCartStore.getState().addItem(item(1, MAX_ITEM_QUANTITY));
    useCartStore.getState().addItem(item(1, 50));
    expect(useCartStore.getState().items[0].quantity).toBe(MAX_ITEM_QUANTITY);
  });

  it('addItem caps quantity for new lines', () => {
    useCartStore.getState().addItem(item(2, 5000));
    expect(useCartStore.getState().items[0].quantity).toBe(MAX_ITEM_QUANTITY);
  });

  it('updateQuantity removes the line when dropping to zero', () => {
    useCartStore.getState().addItem(item(3, 2));
    useCartStore.getState().updateQuantity(3, 0);
    expect(useCartStore.getState().items).toEqual([]);
  });

  it('keeps different variations of the same product as separate lines', () => {
    useCartStore.getState().addItem({ ...item(5, 1), productId: 5, variationId: 1 });
    useCartStore.getState().addItem({ ...item(5, 1), productId: 5, variationId: 2 });
    expect(useCartStore.getState().items).toHaveLength(2);
  });

  it('removes only the selected variation', () => {
    useCartStore.getState().addItem({ ...item(6, 1), productId: 6, variationId: 1 });
    useCartStore.getState().addItem({ ...item(6, 1), productId: 6, variationId: 2 });
    useCartStore.getState().removeItem(6, 1);
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].variationId).toBe(2);
  });

  it('updateQuantity never exceeds the cap', () => {
    useCartStore.getState().addItem(item(4, 5));
    useCartStore.getState().updateQuantity(4, 99999);
    expect(useCartStore.getState().items[0].quantity).toBe(MAX_ITEM_QUANTITY);
  });
});
