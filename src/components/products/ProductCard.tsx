'use client';

import { motion, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';
import { getStorageUrl } from '@/lib/supabase';
import { WishlistButton } from './WishlistButton';

interface ProductCardProps {
  product: {
    id: number;
    name: string;
    slug: string;
    price: number;
    regular_price?: number | null;
    sale_price?: number | null;
    image_url: string | null;
  };
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

export function ProductCard({ product }: ProductCardProps) {
  const { dataPoints } = useDataPoints('products');
  const isOnSale = product.regular_price && product.regular_price > product.price;
  const href = `/products/${product.slug}`;
  // `whileHover` is a JS transform, so the global prefers-reduced-motion CSS
  // guard cannot intercept it. The hook has to be checked in JS.
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={prefersReducedMotion ? undefined : { y: -8 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="group relative flex flex-col h-full bg-surface-card border border-border rounded-4xl overflow-hidden shadow-card hover:shadow-float transition-shadow duration-500 ease-out"
    >
      {isOnSale && (
        <div className="absolute top-6 left-6 z-30 bg-primary text-white text-xs font-black px-4 py-2 rounded-full uppercase tracking-[0.2em] shadow-float">
          <DataPoint as="span" name="products.card.on_sale" initialData={dataPoints}>
            On Sale
          </DataPoint>
        </div>
      )}

      {/*
        The image is a second link to the same destination as the title. It stays
        in the accessibility tree for context but is removed from the tab order so
        keyboard users get one stop per card, not three.
      */}
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative h-64 sm:h-72 overflow-hidden bg-surface-muted block"
      >
        {product.image_url ? (
          <Image
            src={getStorageUrl(product.image_url)}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="w-full h-full object-center object-cover group-hover:scale-110 motion-reduce:group-hover:scale-100 transition-transform duration-300 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground font-black uppercase tracking-[0.2em] text-xs">
            <DataPoint as="span" name="products.card.no_image" initialData={dataPoints}>
              No Image
            </DataPoint>
          </div>
        )}

        <div className="absolute inset-0 bg-secondary/0 group-hover:bg-secondary/5 transition-colors duration-500 ease-out" />
      </Link>

      {/*
        The wishlist control used to be `opacity-0 group-hover:opacity-100`, which
        never fires on a touch device — the button was completely unreachable on
        mobile, and on desktop it sat in the tab order while invisible. It is now
        always visible where hover does not exist, revealed on pointer devices,
        and revealed on keyboard focus.
      */}
      <div className="absolute top-4 right-4 z-20 transition-all duration-300 ease-out hover-capable:translate-y-2 hover-capable:opacity-0 hover-capable:group-hover:translate-y-0 hover-capable:group-hover:opacity-100 focus-within:translate-y-0 focus-within:opacity-100">
        <WishlistButton product={product} />
      </div>

      <div className="p-6 sm:p-8 grow flex flex-col justify-between relative z-10">
        <div>
          <h3 className="text-sm font-black text-foreground uppercase tracking-tighter mb-2 line-clamp-2 min-h-10 sm:min-h-12 leading-tight group-hover:text-primary dark:group-hover:text-primary-on-dark transition-colors duration-300 ease-out">
            <Link href={href} className={`rounded-sm ${FOCUS_RING}`}>
              {product.name}
            </Link>
          </h3>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 sm:mt-8">
          <div className="flex flex-col">
            <span className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-0.5">
              <DataPoint as="span" name="products.card.price_label" initialData={dataPoints}>
                Price
              </DataPoint>
            </span>
            <div className="flex flex-col">
              {isOnSale && (
                <span className="text-sm text-muted-foreground line-through font-medium mb-1">
                  ${product.regular_price?.toFixed(2)}
                </span>
              )}
              <p className="text-lg sm:text-2xl font-black text-primary-ink dark:text-primary-on-dark leading-none tabular-nums">
                ${product.price.toFixed(2)}
              </p>
            </div>
          </div>

          <span
            aria-hidden="true"
            className="bg-secondary text-white text-xs font-black px-4 sm:px-6 py-2.5 sm:py-3 rounded-full transition-colors duration-300 ease-out uppercase tracking-[0.2em] shadow-lg shadow-secondary/10 group-hover:bg-primary dark:border dark:border-white/15 dark:shadow-xs text-center"
          >
            <DataPoint as="span" name="products.card.details" initialData={dataPoints}>
              View Gear
            </DataPoint>
          </span>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 h-1 w-0 bg-primary group-hover:w-full motion-reduce:transition-none transition-all duration-300 ease-out"
      />
    </motion.div>
  );
}
