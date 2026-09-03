'use client';

import { ChevronDown, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
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

  const handleAddToCart = () => {
    addItem({
      id: selectedVariation ? selectedVariation.id : product.id,
      name: selectedVariation
        ? `${product.name} - ${Object.values(selectedVariation.attributes).join(', ')}`
        : product.name,
      price: selectedVariation ? selectedVariation.price : product.price,
      quantity: 1,
      image_url: product.image_url,
      slug: product.slug,
    });

    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
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
            className="block text-xs font-black text-secondary uppercase tracking-widest mb-2"
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
              className="w-full appearance-none bg-slate-50 border border-slate-200 text-secondary py-4 px-5 pr-10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-bold text-sm uppercase tracking-wider"
            >
              {variations.map((v) => (
                <option key={v.id} value={v.id}>
                  {Object.values(v.attributes).join(' / ')} - ${v.price.toFixed(2)}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
              <ChevronDown size={20} />
            </div>
          </div>
        </div>
      )}

      {variations.length > 0 && (
        <div className="mt-4 mb-6">
          <p className="text-4xl font-black text-primary">${displayPrice.toFixed(2)}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleAddToCart}
        disabled={isOutOfStock}
        className={`w-full border-none rounded-full py-5 px-10 flex items-center justify-center text-sm font-black text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all uppercase tracking-widest shadow-xl ${
          isOutOfStock
            ? 'bg-slate-300 cursor-not-allowed shadow-none'
            : isAdded
              ? 'bg-emerald-500 shadow-emerald-100 scale-95'
              : 'bg-primary hover:bg-primary-dark shadow-primary/20 hover:scale-[1.02] active:scale-95'
        }`}
      >
        <ShoppingCart className="mr-3" size={20} strokeWidth={3} />
        {isOutOfStock ? 'Out of stock' : isAdded ? 'Added to Cart!' : 'Add to bag'}
      </button>

      <div className="flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
        Secure checkout via Stripe
      </div>
    </div>
  );
}
