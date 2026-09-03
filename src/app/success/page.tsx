'use client';

import { CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { useCartStore } from '@/lib/store/cart';

export default function SuccessPage() {
  const clearCart = useCartStore((state) => state.clearCart);

  useEffect(() => {
    // Clear the cart when the user successfully checks out
    clearCart();
  }, [clearCart]);

  return (
    <div className="min-h-[80vh] bg-white flex items-center justify-center px-4 pt-(--header-h) pb-16">
      <div className="max-w-md w-full bg-slate-50 p-10 rounded-3xl shadow-sm text-center border border-slate-100">
        <div className="bg-emerald-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
          <CheckCircle className="w-12 h-12 text-emerald-600" strokeWidth={3} />
        </div>
        <h1 className="text-3xl font-black text-secondary uppercase tracking-tight mb-4">
          Order Confirmed!
        </h1>
        <p className="text-slate-600 mb-10 font-medium leading-relaxed">
          Thank you for choosing Catch-22. We&apos;ve received your order and are getting it ready
          for the elements.
        </p>
        <Link
          href="/products"
          className="w-full inline-block py-5 px-8 bg-primary hover:bg-primary-dark text-white font-black rounded-full transition-all uppercase tracking-[0.2em] text-sm shadow-xl shadow-primary/20"
        >
          Continue Shopping
        </Link>
        <p className="mt-8 text-[10px] text-slate-400 font-black uppercase tracking-widest">
          2.5% of your purchase is donated to NZ Sea Cleaners
        </p>
      </div>
    </div>
  );
}
