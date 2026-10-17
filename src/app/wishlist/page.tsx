'use client';

import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';
import { useCartStore } from '@/lib/store/cart';
import { useWishlistStore } from '@/lib/store/wishlist';
import { getStorageUrl } from '@/lib/supabase';

export default function WishlistPage() {
  const { dataPoints } = useDataPoints('wishlist');
  const { items, removeItem, clearWishlist } = useWishlistStore();
  const addItemToCart = useCartStore((state) => state.addItem);
  const mountedRef = useRef(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      setIsMounted(true);
    }
  }, []);

  if (!isMounted) {
    return <div className="min-h-screen bg-background" />;
  }

  const handleMoveToCart = (item: {
    id: number;
    name: string;
    slug: string;
    price: number;
    image_url: string | null;
  }) => {
    addItemToCart({
      id: item.id,
      name: item.name,
      slug: item.slug,
      price: item.price,
      image_url: item.image_url,
      quantity: 1,
    });
    removeItem(item.id);
  };

  return (
    <div className="bg-background min-h-screen pt-(--header-h) pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center text-center mb-16">
          <h1 className="text-4xl font-black text-foreground uppercase tracking-tight mb-4">
            <DataPoint initialData={dataPoints} name="wishlist.hero.title">
              My Wishlist
            </DataPoint>
          </h1>
          <div className="h-2 w-24 bg-primary" />
        </div>

        {items.length === 0 ? (
          <div className="text-center py-32 bg-surface-muted rounded-[3rem] border border-dashed border-border">
            <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
            <p className="text-muted-foreground font-bold uppercase tracking-widest mb-8">
              <DataPoint initialData={dataPoints} name="wishlist.empty.title">
                Your wishlist is empty.
              </DataPoint>
            </p>
            <Link
              href="/products"
              className="inline-block bg-secondary text-white font-black py-4 px-10 rounded-full transition-all uppercase tracking-widest text-sm hover:bg-primary shadow-xl shadow-secondary/10"
            >
              <DataPoint initialData={dataPoints} name="wishlist.empty.btn">
                Explore Gear
              </DataPoint>
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clearWishlist}
                className="text-xs font-black text-rose-500 uppercase tracking-widest hover:text-rose-700 transition-colors"
              >
                <DataPoint initialData={dataPoints} name="wishlist.btn.clear">
                  Clear Wishlist
                </DataPoint>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group bg-surface-card rounded-3xl border border-border shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300"
                >
                  <Link
                    href={`/products/${item.slug}`}
                    className="relative h-64 block overflow-hidden bg-surface-muted"
                  >
                    {item.image_url ? (
                      <Image
                        src={getStorageUrl(item.image_url)}
                        alt={item.name}
                        fill
                        sizes="(max-width: 640px) 50vw, 25vw"
                        className="object-cover group-hover:scale-105 motion-reduce:group-hover:scale-100 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground font-black uppercase tracking-widest text-[10px]">
                        <DataPoint initialData={dataPoints} name="wishlist.item.no_image">
                          No Image
                        </DataPoint>
                      </div>
                    )}
                  </Link>
                  <div className="p-8">
                    <h2 className="text-lg font-black text-foreground uppercase mb-2 line-clamp-1">
                      {item.name}
                    </h2>
                    <p className="text-xl font-black text-primary dark:text-primary-on-dark mb-8">
                      ${item.price.toFixed(2)}
                    </p>

                    <div className="flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={() => handleMoveToCart(item)}
                        className="flex items-center justify-center gap-2 bg-secondary text-white font-black py-4 rounded-full transition-all uppercase tracking-widest text-xs hover:bg-primary"
                      >
                        <ShoppingCart size={16} />{' '}
                        <DataPoint initialData={dataPoints} name="wishlist.btn.add_to_cart">
                          Add to Cart
                        </DataPoint>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="flex items-center justify-center gap-2 text-muted-foreground font-black py-2 rounded-full transition-all uppercase tracking-widest text-[10px] hover:text-rose-500"
                      >
                        <Trash2 size={14} />{' '}
                        <DataPoint initialData={dataPoints} name="wishlist.btn.remove">
                          Remove
                        </DataPoint>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
