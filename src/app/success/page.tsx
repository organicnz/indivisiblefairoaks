'use client';

import { CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { DataPoint } from '@/components/ui/DataPoint';
import { useCartStore } from '@/lib/store/cart';

export default function SuccessPage() {
  const clearCart = useCartStore((state) => state.clearCart);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('session_id')) {
      clearCart();
    }
  }, [clearCart]);

  return (
    <div className="min-h-[80vh] bg-white flex items-center justify-center px-4 pt-(--header-h) pb-16">
      <div className="max-w-md w-full bg-slate-50 p-10 rounded-3xl shadow-sm text-center border border-slate-100">
        <div className="bg-emerald-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
          <CheckCircle className="w-12 h-12 text-emerald-600" strokeWidth={3} />
        </div>
        <DataPoint
          name="success.hero.title"
          as="h1"
          className="text-3xl font-black text-secondary uppercase tracking-tight mb-4"
        >
          Order Confirmed!
        </DataPoint>
        <DataPoint
          name="success.hero.desc"
          as="p"
          className="text-slate-600 mb-10 font-medium leading-relaxed"
        >
          Thank you for supporting Indivisible Fair Oaks-Carmichael. We have received your order and
          will follow up with details shortly.
        </DataPoint>
        <Link
          href="/"
          className="w-full inline-block py-5 px-8 bg-primary hover:bg-primary-light text-white font-black rounded-full transition-all uppercase tracking-[0.2em] text-sm shadow-xl"
        >
          <DataPoint name="success.btn.home" as="span">
            Return to Home
          </DataPoint>
        </Link>
        <DataPoint
          name="success.badge.volunteer"
          as="p"
          className="mt-8 text-[10px] text-slate-400 font-black uppercase tracking-widest"
        >
          100% Volunteer Powered • Grassroots Community Funded
        </DataPoint>
      </div>
    </div>
  );
}
