'use client';

import { Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useWishlistStore } from '@/lib/store/wishlist';

interface WishlistButtonProps {
  product: {
    id: number;
    name: string;
    slug: string;
    price: number;
    image_url: string | null;
  };
  showText?: boolean;
}

export function WishlistButton({ product, showText = false }: WishlistButtonProps) {
  const { addItem, removeItem, isInWishlist } = useWishlistStore();
  const [isMounted, setIsMounted] = useState(false);
  const active = isMounted && isInWishlist(product.id);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (active) {
      removeItem(product.id);
    } else {
      addItem(product);
    }
  };

  if (!isMounted) return null;

  return (
    <button
      type="button"
      onClick={toggleWishlist}
      className={`flex items-center justify-center gap-2 transition-all ${
        showText
          ? 'w-full py-4 rounded-full border-2 font-black uppercase tracking-widest text-xs'
          : 'p-2 rounded-full shadow-md'
      } ${
        active
          ? 'bg-rose-50 border-rose-200 text-rose-500'
          : 'bg-white border-slate-100 text-slate-400 hover:text-rose-500'
      }`}
      title={active ? 'Remove from Wishlist' : 'Add to Wishlist'}
    >
      <Heart
        size={showText ? 16 : 20}
        fill={active ? 'currentColor' : 'none'}
        strokeWidth={active ? 0 : 2.5}
      />
      {showText && (active ? 'In Wishlist' : 'Add to Wishlist')}
    </button>
  );
}
