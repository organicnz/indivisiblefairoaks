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

  const label = active ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`;

  return (
    <button
      type="button"
      onClick={toggleWishlist}
      // `aria-pressed` is what exposes the toggle state. `title` alone is not
      // reliably announced and does not convey on/off at all.
      aria-pressed={active}
      aria-label={showText ? undefined : label}
      className={`inline-flex items-center justify-center gap-2 transition-colors duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        showText
          ? 'w-full min-h-11 py-4 rounded-full border-2 font-black uppercase tracking-[0.2em] text-xs'
          : // 44px minimum target — p-2 plus a 20px glyph is only 36px.
            'size-11 rounded-full shadow-raised'
      } ${
        active
          ? // `accent-red` is 4.83:1 on white; `rose-500` measured 3.34:1 and failed.
            'bg-rose-50 border-rose-200 text-accent-red'
          : 'bg-surface-card border-border text-muted-foreground hover:text-accent-red'
      }`}
    >
      <Heart
        size={showText ? 16 : 20}
        fill={active ? 'currentColor' : 'none'}
        strokeWidth={active ? 0 : 2.5}
        aria-hidden="true"
      />
      {showText && (active ? 'In Wishlist' : 'Add to Wishlist')}
    </button>
  );
}
