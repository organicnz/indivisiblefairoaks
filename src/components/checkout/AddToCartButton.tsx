'use client';

import { ChevronDown, ShoppingCart } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useCartStore } from '@/lib/store/cart';

interface Variation {
  id: number;
  price: number;
  attributes: Record<string, string>;
  stock_status: string | null;
}

interface AddToCartButtonProps {
  product: {
    id: number;
    name: string;
    price: number;
    image_url: string | null;
    slug: string;
    stock_status: string | null;
  };
  variations?: Variation[];
}

export function AddToCartButton({ product, variations = [] }: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [isAdded, setIsAdded] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState<Variation | null>(
    variations.length > 0 ? variations[0] : null
  );
  // The confirmation timer used to be a bare setTimeout with no cleanup, so
  // navigating away inside those two seconds set state on an unmounted
  // component. Held in a ref so the effect can cancel it on unmount.
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    []
  );

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      productId: product.id,
      variationId: selectedVariation?.id ?? null,
      name: selectedVariation
        ? `${product.name} - ${Object.values(selectedVariation.attributes).join(', ')}`
        : product.name,
      price: selectedVariation ? selectedVariation.price : product.price,
      quantity: 1,
      image_url: product.image_url,
      slug: product.slug,
    });

    setIsAdded(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setIsAdded(false), 3000);
  };

  const isOutOfStock = selectedVariation
    ? selectedVariation.stock_status !== 'instock'
    : product.stock_status !== 'instock';

  const displayPrice = selectedVariation ? selectedVariation.price : product.price;

  return (
    <div className="w-full space-y-6">
      {variations.length > 0 && (
        <div className="relative">
          <label
            htmlFor="variation"
            className="block text-xs font-black text-foreground uppercase tracking-widest mb-2"
          >
            Select Option
          </label>
          <div className="relative">
            <select
              id="variation"
              value={selectedVariation?.id || ''}
              onChange={(e) => {
                const v = variations.find((v) => v.id === Number.parseInt(e.target.value, 10));
                if (v) setSelectedVariation(v);
              }}
              className="w-full appearance-none bg-surface-muted border border-border text-foreground py-4 px-5 pr-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent font-bold text-sm uppercase tracking-wider"
            >
              {variations.map((v) => (
                <option key={v.id} value={v.id}>
                  {Object.values(v.attributes).join(' / ')} - ${v.price.toFixed(2)}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-muted-foreground">
              <ChevronDown size={20} />
            </div>
          </div>
        </div>
      )}

      {variations.length > 0 && (
        <div className="mt-4 mb-6">
          <p className="text-4xl font-black text-primary dark:text-primary-on-dark">
            ${displayPrice.toFixed(2)}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleAddToCart}
        disabled={isOutOfStock}
        className={`w-full border-none rounded-full py-5 px-10 flex items-center justify-center text-sm font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-all duration-300 ease-out uppercase tracking-[0.2em] shadow-float ${
          isOutOfStock
            ? 'bg-border cursor-not-allowed shadow-none'
            : isAdded
              ? 'bg-emerald-600 scale-95'
              : 'bg-primary hover:bg-primary-dark shadow-primary/20 hover:scale-[1.02] active:scale-95'
        }`}
      >
        <ShoppingCart className="mr-3" size={20} strokeWidth={3} aria-hidden="true" />
        {isOutOfStock ? 'Out of stock' : isAdded ? 'Added to Cart!' : 'Add to bag'}
      </button>

      {/*
        The button label mutates on success, but nothing announced it: a
        screen-reader user pressed "Add to bag" and heard silence. `aria-live`
        on a region that is always in the DOM (not conditionally rendered) is
        what makes the change announce.
      */}
      <p role="status" aria-live="polite" className="sr-only">
        {isOutOfStock
          ? `${product.name} is out of stock.`
          : isAdded
            ? `${product.name} added to your cart.`
            : ''}
      </p>

      <div className="flex items-center justify-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">
        <span
          aria-hidden="true"
          className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse motion-reduce:animate-none"
        />
        Secure checkout via Stripe
      </div>
    </div>
  );
}
