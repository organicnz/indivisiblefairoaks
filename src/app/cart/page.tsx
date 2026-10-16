'use client';

import { ArrowRight, Minus, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { StripeExpressCheckout } from '@/components/checkout/StripeExpressCheckout';
import { DataPoint } from '@/components/ui/DataPoint';
import { SHIPPING_RATES } from '@/config/commerce';
import { buildCheckoutItems } from '@/lib/checkout-validation';
import { MAX_ITEM_QUANTITY, useCartStore } from '@/lib/store/cart';
import { getStorageUrl } from '@/lib/supabase';

/** No-op store subscription: hydration state never changes after mount. */
const emptySubscribe = () => () => {};

export default function CartPage() {
  const { items, removeItem, updateQuantity, totalPrice } = useCartStore();
  const [isLoading, setIsLoading] = useState(false);
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
        body: JSON.stringify({ items: buildCheckoutItems(items) }),
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
      <div className="bg-background min-h-screen pt-(--header-h) pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-pulse">
          <div className="h-10 w-48 bg-surface-muted rounded mb-8" />
          <div className="space-y-4">
            {['tall', 'medium', 'short'].map((row) => (
              <div key={row} className="h-28 bg-surface-muted rounded-3xl border border-border" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-background min-h-[70vh] flex flex-col items-center justify-center px-4 py-24 text-center">
        <DataPoint
          name="cart.empty.title"
          as="h1"
          className="text-4xl font-black text-foreground uppercase tracking-tight mb-6"
        >
          Your Cart is Empty
        </DataPoint>
        <DataPoint
          name="cart.empty.desc"
          as="p"
          className="text-muted-foreground font-medium mb-10 max-w-sm"
        >
          Looks like you haven&apos;t added any gear yet. Let&apos;s get you equipped.
        </DataPoint>
        <Link
          href="/products"
          className="inline-block bg-primary hover:bg-primary-dark text-white font-black py-4 px-10 rounded-full transition-all uppercase tracking-widest text-sm shadow-xl shadow-primary/20"
        >
          <DataPoint name="cart.empty.btn" as="span">
            Start Shopping
          </DataPoint>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen pt-(--header-h) pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col mb-10">
          <DataPoint
            name="cart.header.title"
            as="h1"
            className="text-4xl font-black tracking-tighter text-foreground uppercase"
          >
            Your Cart
          </DataPoint>
          <div className="h-1.5 w-24 bg-primary mt-3" />
        </div>

        <div className="lg:grid lg:grid-cols-12 lg:gap-x-12 lg:items-start">
          <div className="lg:col-span-7">
            <ul className="border-t border-border divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="flex py-8 sm:py-10 group">
                  <div className="flex-shrink-0">
                    <div className="w-24 h-24 sm:w-40 sm:h-40 bg-surface-muted rounded-2xl border border-border object-center object-cover relative overflow-hidden shadow-sm transition-shadow group-hover:shadow-md">
                      {item.image_url ? (
                        <Image
                          src={getStorageUrl(item.image_url)}
                          alt={item.name}
                          fill
                          sizes="(max-width: 640px) 96px, 160px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground font-black uppercase tracking-widest text-[10px]">
                          <DataPoint name="cart.item.no_image">No Image</DataPoint>
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
                              className="font-black text-foreground hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark transition-colors uppercase leading-tight"
                            >
                              {item.name}
                            </Link>
                          </h3>
                        </div>
                        <p className="mt-2 text-xl font-black text-primary dark:text-primary-on-dark">
                          ${item.price.toFixed(2)}
                        </p>
                      </div>

                      <div className="mt-6 sm:mt-0 sm:pr-9">
                        <div className="flex items-center bg-surface-muted border border-border rounded-full w-min p-1 shadow-inner">
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
                            className="inline-flex items-center justify-center size-11 rounded-full text-foreground hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark transition-colors duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            // The buttons said "Increase quantity" with no product
                            // named, so a screen-reader user heard the same label
                            // once per line in the cart.
                            aria-label={`Decrease quantity of ${item.name}`}
                          >
                            <Minus size={16} strokeWidth={3} aria-hidden="true" />
                          </button>
                          {/*
                            `role="status"` + aria-live: the stepper used to change
                            the number silently, and the +/- labels never named the
                            product, so the quantity was never announced at all.
                          */}
                          <span
                            role="status"
                            aria-live="polite"
                            aria-label={`Quantity of ${item.name}`}
                            className="px-4 text-sm font-black text-foreground tabular-nums"
                          >
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
                            className="inline-flex items-center justify-center size-11 rounded-full text-foreground hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark transition-colors duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            aria-label={`Increase quantity of ${item.name}`}
                          >
                            <Plus size={16} strokeWidth={3} aria-hidden="true" />
                          </button>
                        </div>

                        <div className="absolute top-0 right-0">
                          <button
                            type="button"
                            className="-m-2 inline-flex items-center justify-center size-11 rounded-full text-muted-foreground hover:text-accent-red transition-colors duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red focus-visible:ring-offset-2"
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
          <section className="mt-16 bg-surface-muted rounded-3xl px-6 py-8 sm:p-8 lg:mt-0 lg:col-span-5 border border-border shadow-sm sticky top-24">
            <h2 className="text-xl font-black text-foreground uppercase tracking-widest mb-8 border-b-2 border-primary pb-2 inline-block">
              <DataPoint name="cart.summary.heading">Order Summary</DataPoint>
            </h2>

            <dl className="mt-6 space-y-6">
              <div className="flex items-center justify-between">
                <dt className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                  <DataPoint name="cart.summary.subtotal">Subtotal</DataPoint>
                </dt>
                <dd className="text-lg font-black text-foreground">${totalPrice().toFixed(2)}</dd>
              </div>
              <div className="flex items-start justify-between">
                <dt className="text-xs font-black text-muted-foreground uppercase tracking-widest mt-0.5">
                  <DataPoint name="cart.summary.shipping_label">Shipping</DataPoint>
                </dt>
                <dd className="text-right">
                  <span className="text-xs font-black text-emerald-600 uppercase tracking-widest block">
                    <DataPoint name="cart.summary.shipping_note">Calculated at Checkout</DataPoint>
                  </span>
                  <Link
                    href="/shipping-returns"
                    className="text-[10px] text-muted-foreground font-medium underline hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark transition-colors mt-1 inline-block"
                  >
                    <DataPoint name="cart.shipping.view_rates" as="span">
                      View Rates (From{' '}
                      {SHIPPING_RATES.find((r) => r.id === 'standard')?.displayPrice || '$8.00'} or
                      Free Pickup)
                    </DataPoint>
                  </Link>
                </dd>
              </div>
              <div className="border-t border-border pt-6 flex items-center justify-between">
                <dt className="text-xl font-black text-foreground uppercase tracking-tighter">
                  <DataPoint name="cart.summary.total_label">Order total</DataPoint>
                </dt>
                <dd className="text-3xl font-black text-primary dark:text-primary-on-dark tracking-tighter">
                  ${totalPrice().toFixed(2)}
                </dd>
              </div>
            </dl>

            <div className="mt-8">
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isLoading}
                className="w-full bg-secondary text-white rounded-full py-5 px-6 text-sm font-black uppercase tracking-[0.2em] hover:bg-primary active:bg-primary-dark transition-colors duration-300 ease-out shadow-float flex justify-center items-center disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {isLoading ? (
                  <DataPoint name="cart.btn.processing" as="span">
                    Processing...
                  </DataPoint>
                ) : (
                  <>
                    <DataPoint name="cart.btn.checkout" as="span">
                      Proceed to Checkout
                    </DataPoint>
                    <ArrowRight className="ml-3" size={20} strokeWidth={3} />
                  </>
                )}
              </button>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="h-px bg-surface-muted flex-1" />
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  <DataPoint name="cart.summary.express_label">Express Checkout</DataPoint>
                </span>
                <div className="h-px bg-surface-muted flex-1" />
              </div>
              <StripeExpressCheckout />
            </div>

            <div className="mt-8 flex flex-col items-center gap-4 border-t border-border pt-8">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  <DataPoint name="cart.summary.secure_label">Secure Checkout Guaranteed</DataPoint>
                </span>
              </div>
              <DataPoint
                name="cart.notice.cause"
                as="p"
                className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight text-center leading-relaxed"
              >
                100% of proceeds fund local civic actions &amp; grassroots organizing
              </DataPoint>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
