'use client';

import { ArrowRight, Minus, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { StripeExpressCheckout } from '@/components/checkout/StripeExpressCheckout';
import { SHIPPING_RATES } from '@/config/shipping';
import { MAX_ITEM_QUANTITY, useCartStore } from '@/lib/store/cart';
import { getStorageUrl } from '@/lib/supabase';

/** No-op store subscription: hydration state never changes after mount. */
const emptySubscribe = () => () => {};

export default function CartPage() {
  const { items, removeItem, updateQuantity, totalPrice } = useCartStore();
  const [isLoading, setIsLoading] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  // Persisted cart rehydrates client-side only; render the skeleton on the
  // server/first paint to avoid an empty-cart mismatch flash.
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const handleCheckout = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            id: item.productId ?? item.id,
            variationId: item.variationId ?? undefined,
            quantity: item.quantity,
          })),
          promoCode: promoCode.trim(),
        }),
      });
      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      // Out-of-stock (409): drop the dead line from the cart so retry works.
      if (response.status === 409 && data.productId) {
        removeItem(data.productId, data.variationId ?? null);
        toast.error(data.error || 'An item sold out and was removed from your cart.');
        return;
      }

      // Rate limited (429): surface the wait instead of a generic failure.
      if (response.status === 429) {
        const retry = Number(response.headers.get('Retry-After')) || 30;
        toast.error(`Too many attempts — try again in ${retry}s.`);
        return;
      }

      toast.error(data.error || 'Something went wrong starting checkout.');
    } catch {
      toast.error('Checkout failed — check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!hydrated) {
    return (
      <div className="bg-white min-h-screen pt-(--header-h) pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-pulse">
          <div className="h-10 w-48 bg-slate-100 rounded mb-8" />
          <div className="space-y-4">
            {['tall', 'medium', 'short'].map((row) => (
              <div key={row} className="h-28 bg-slate-50 rounded-3xl border border-slate-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white min-h-[70vh] flex flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="text-4xl font-black text-secondary uppercase tracking-tight mb-6">
          Your Cart is Empty
        </h1>
        <p className="text-slate-500 font-medium mb-10 max-w-sm">
          Looks like you haven&apos;t added any gear yet. Let&apos;s get you equipped.
        </p>
        <Link
          href="/products"
          className="inline-block bg-primary hover:bg-primary-dark text-white font-black py-4 px-10 rounded-full transition-all uppercase tracking-widest text-sm shadow-xl shadow-primary/20"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pt-(--header-h) pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col mb-10">
          <h1 className="text-4xl font-black tracking-tight text-secondary uppercase">Your Cart</h1>
          <div className="h-1.5 w-24 bg-primary mt-3" />
        </div>

        <div className="lg:grid lg:grid-cols-12 lg:gap-x-12 lg:items-start">
          <div className="lg:col-span-7">
            <ul className="border-t border-slate-100 divide-y divide-slate-100">
              {items.map((item) => (
                <li key={item.id} className="flex py-8 sm:py-10 group">
                  <div className="flex-shrink-0">
                    <div className="w-24 h-24 sm:w-40 sm:h-40 bg-slate-50 rounded-2xl border border-slate-100 object-center object-cover relative overflow-hidden shadow-sm transition-shadow group-hover:shadow-md">
                      {item.image_url ? (
                        <Image
                          src={getStorageUrl(item.image_url)}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 font-black uppercase tracking-widest text-[10px]">
                          No Image
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="ml-6 flex-1 flex flex-col justify-between">
                    <div className="relative pr-9 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:pr-0">
                      <div>
                        <div className="flex justify-between">
                          <h3 className="text-md sm:text-lg">
                            <Link
                              href={`/products/${item.slug}`}
                              className="font-black text-secondary hover:text-primary transition-colors uppercase leading-tight"
                            >
                              {item.name}
                            </Link>
                          </h3>
                        </div>
                        <p className="mt-2 text-xl font-black text-primary">
                          ${item.price.toFixed(2)}
                        </p>
                      </div>

                      <div className="mt-6 sm:mt-0 sm:pr-9">
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-full w-min p-1 shadow-inner">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.productId ?? item.id,
                                Math.max(1, item.quantity - 1),
                                item.variationId ?? null
                              )
                            }
                            disabled={item.quantity <= 1}
                            className="p-2 text-secondary hover:text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Decrease quantity"
                          >
                            <Minus size={16} strokeWidth={3} />
                          </button>
                          <span className="px-4 text-sm font-black text-secondary">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.productId ?? item.id,
                                Math.min(item.quantity + 1, MAX_ITEM_QUANTITY),
                                item.variationId ?? null
                              )
                            }
                            disabled={item.quantity >= MAX_ITEM_QUANTITY}
                            className="p-2 text-secondary hover:text-primary transition-colors"
                            aria-label="Increase quantity"
                          >
                            <Plus size={16} strokeWidth={3} />
                          </button>
                        </div>

                        <div className="absolute top-0 right-0">
                          <button
                            type="button"
                            className="-m-2 p-2 inline-flex text-slate-300 hover:text-rose-500 transition-colors"
                            onClick={() =>
                              removeItem(item.productId ?? item.id, item.variationId ?? null)
                            }
                            aria-label={`Remove ${item.name} from cart`}
                          >
                            <span className="sr-only">Remove</span>
                            <Trash2 size={20} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Order summary */}
          <section className="mt-16 bg-slate-50 rounded-3xl px-6 py-8 sm:p-8 lg:mt-0 lg:col-span-5 border border-slate-100 shadow-sm sticky top-24">
            <h2 className="text-xl font-black text-secondary uppercase tracking-widest mb-8 border-b-2 border-primary pb-2 inline-block">
              Order Summary
            </h2>

            <dl className="mt-6 space-y-6">
              <div className="flex items-center justify-between">
                <dt className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Subtotal
                </dt>
                <dd className="text-lg font-black text-secondary">${totalPrice().toFixed(2)}</dd>
              </div>
              <div className="flex items-start justify-between">
                <dt className="text-xs font-black text-slate-500 uppercase tracking-widest mt-0.5">
                  Shipping
                </dt>
                <dd className="text-right">
                  <span className="text-xs font-black text-emerald-600 uppercase tracking-widest block">
                    Calculated at Checkout
                  </span>
                  <Link
                    href="/shipping-returns"
                    className="text-[10px] text-slate-400 font-medium underline hover:text-primary transition-colors mt-1 inline-block"
                  >
                    View Rates (From{' '}
                    {SHIPPING_RATES.find((r) => r.id === 'standard')?.displayPrice || '$8.00'} or
                    Free Pickup)
                  </Link>
                </dd>
              </div>
              <div className="border-t border-slate-200 pt-6 flex items-center justify-between">
                <dt className="text-xl font-black text-secondary uppercase tracking-tight">
                  Order total
                </dt>
                <dd className="text-3xl font-black text-primary tracking-tighter">
                  ${totalPrice().toFixed(2)}
                </dd>
              </div>
            </dl>

            <div className="mt-10">
              <label
                htmlFor="promo"
                className="block text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-3 ml-1"
              >
                Promo Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="promo"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="ENTER CODE"
                  className="block w-full px-5 py-3 bg-white border border-slate-200 rounded-full text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all shadow-inner"
                />
                <button
                  type="button"
                  className="bg-slate-200 text-slate-600 px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest hover:bg-slate-300 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="mt-8">
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isLoading}
                className="w-full bg-secondary text-white rounded-full py-5 px-6 text-sm font-black uppercase tracking-[0.2em] hover:bg-primary transition-all shadow-xl shadow-secondary/10 flex justify-center items-center disabled:opacity-50"
              >
                {isLoading ? 'Processing...' : 'Proceed to Checkout'}
                {!isLoading && <ArrowRight className="ml-3" size={20} strokeWidth={3} />}
              </button>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="h-px bg-slate-200 flex-1" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Express Checkout
                </span>
                <div className="h-px bg-slate-200 flex-1" />
              </div>
              <StripeExpressCheckout />
            </div>

            <div className="mt-8 flex flex-col items-center gap-4 border-t border-slate-100 pt-8">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Secure Checkout Guaranteed
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight text-center leading-relaxed">
                2.5% of this purchase goes to NZ Sea Cleaners Charity Trust
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
