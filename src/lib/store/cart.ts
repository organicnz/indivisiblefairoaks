import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: number;
  productId?: number;
  variationId?: number | null;
  name: string;
  price: number;
  quantity: number;
  image_url: string | null;
  slug: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: number, variationId?: number | null) => void;
  updateQuantity: (id: number, quantity: number, variationId?: number | null) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const MAX_ITEM_QUANTITY = 999;

function sameLine(a: CartItem, id: number, variationId: number | null = null) {
  return (a.productId ?? a.id) === id && (a.variationId ?? null) === variationId;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const items = get().items;
        const existingItem = items.find((i) =>
          sameLine(i, item.productId ?? item.id, item.variationId ?? null)
        );

        if (existingItem) {
          set({
            items: items.map((i) =>
              sameLine(i, item.productId ?? item.id, item.variationId ?? null)
                ? { ...i, quantity: Math.min(i.quantity + item.quantity, MAX_ITEM_QUANTITY) }
                : i
            ),
          });
        } else {
          set({
            items: [...items, { ...item, quantity: Math.min(item.quantity, MAX_ITEM_QUANTITY) }],
          });
        }
      },
      removeItem: (id, variationId = null) =>
        set({ items: get().items.filter((i) => !sameLine(i, id, variationId)) }),
      updateQuantity: (id, quantity, variationId = null) => {
        if (quantity < 1) {
          set({ items: get().items.filter((i) => !sameLine(i, id, variationId)) });
          return;
        }
        set({
          items: get().items.map((i) =>
            sameLine(i, id, variationId)
              ? { ...i, quantity: Math.min(quantity, MAX_ITEM_QUANTITY) }
              : i
          ),
        });
      },
      clearCart: () => set({ items: [] }),
      totalItems: () => get().items.reduce((total, item) => total + item.quantity, 0),
      totalPrice: () => get().items.reduce((total, item) => total + item.price * item.quantity, 0),
    }),
    {
      name: 'indivisible-cart',
    }
  )
);
