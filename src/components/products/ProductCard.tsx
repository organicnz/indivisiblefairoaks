'use client';

import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
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

export function ProductCard({ product }: ProductCardProps) {
  const isOnSale = product.regular_price && product.regular_price > product.price;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="group relative flex flex-col h-full bg-white border border-slate-100 rounded-4xl overflow-hidden shadow-sm hover:shadow-2xl transition-shadow duration-500"
    >
      {/* Sale Badge */}
      {isOnSale && (
        <div className="absolute top-6 left-6 z-30 bg-primary text-white text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest shadow-xl shadow-primary/20">
          On Sale
        </div>
      )}

      {/* Image Container */}
      <Link
        href={`/products/${product.slug}`}
        className="relative h-48 xs:h-64 sm:h-72 overflow-hidden bg-slate-50 block"
      >
        {product.image_url ? (
          <Image
            src={getStorageUrl(product.image_url)}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="w-full h-full object-center object-cover group-hover:scale-110 transition-transform duration-300 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500 font-black uppercase tracking-widest text-[10px]">
            No Image
          </div>
        )}

        {/* Subtle Overlay on Hover */}
        <div className="absolute inset-0 bg-secondary/0 group-hover:bg-secondary/5 transition-colors duration-500" />
      </Link>

      {/* Wishlist Action */}
      <div className="absolute top-5 right-5 z-20 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
        <WishlistButton product={product} />
      </div>

      {/* Content */}
      <div className="p-4 xs:p-6 sm:p-8 grow flex flex-col justify-between relative z-10">
        <div>
          <h3 className="text-xs sm:text-sm font-black text-secondary uppercase tracking-wider mb-2 line-clamp-2 min-h-8 sm:min-h-10 leading-tight group-hover:text-primary transition-colors duration-300">
            <Link href={`/products/${product.slug}`}>{product.name}</Link>
          </h3>
        </div>

        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-4 mt-6 sm:mt-8">
          <div className="flex flex-col">
            <span className="text-[9px] sm:text-[10px] font-black text-slate-600 uppercase tracking-widest mb-0.5">
              Price
            </span>
            <div className="flex flex-col">
              {isOnSale && (
                <span className="text-[10px] sm:text-xs text-slate-500 line-through font-medium mb-1">
                  ${product.regular_price?.toFixed(2)}
                </span>
              )}
              <p className="text-lg sm:text-2xl font-black text-primary-ink leading-none tabular-nums">
                ${product.price.toFixed(2)}
              </p>
            </div>
          </div>

          <Link
            href={`/products/${product.slug}`}
            className="bg-secondary text-white text-[9px] sm:text-[10px] font-black px-4 sm:px-6 py-2.5 sm:py-3 rounded-full hover:bg-primary transition-all duration-300 uppercase tracking-[0.2em] shadow-lg shadow-secondary/10 group-hover:shadow-primary/20 text-center"
          >
            View Gear
          </Link>
        </div>
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 h-1 w-0 bg-primary group-hover:w-full transition-all duration-300 ease-out" />
    </motion.div>
  );
}
