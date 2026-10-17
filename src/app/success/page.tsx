'use client';

import { CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';
import { useCartStore } from '@/lib/store/cart';

export default function SuccessPage() {
  const { dataPoints } = useDataPoints('success');
  const clearCart = useCartStore((state) => state.clearCart);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('session_id')) {
      clearCart();
    }
  }, [clearCart]);

  return (
    <div className="min-h-[80vh] bg-background flex items-center justify-center px-4 pt-(--header-h) pb-16 text-foreground transition-colors duration-300">
      <div className="max-w-md w-full bg-surface-card p-10 rounded-3xl shadow-raised text-center border border-border">
        <div className="bg-emerald-100 dark:bg-emerald-950/60 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
          <CheckCircle
            className="w-12 h-12 text-emerald-600 dark:text-emerald-400"
            strokeWidth={3}
          />
        </div>
        <DataPoint
          initialData={dataPoints}
          name="success.hero.title"
          as="h1"
          className="text-3xl font-black text-secondary dark:text-white uppercase tracking-tight mb-4"
        >
          Order Confirmed!
        </DataPoint>
        <DataPoint
          initialData={dataPoints}
          name="success.hero.desc"
          as="p"
          className="text-muted-foreground dark:text-ink-on-dark mb-10 font-medium leading-relaxed"
        >
          Thank you for supporting Indivisible Fair Oaks-Carmichael. We have received your order and
          will follow up with details shortly.
        </DataPoint>
        <Link
          href="/"
          className="w-full inline-block py-5 px-8 bg-primary dark:bg-primary-bright hover:bg-primary-light text-white font-black rounded-full transition-all uppercase tracking-[0.2em] text-sm shadow-xl"
        >
          <DataPoint initialData={dataPoints} name="success.btn.home" as="span">
            Return to Home
          </DataPoint>
        </Link>
        <DataPoint
          initialData={dataPoints}
          name="success.badge.volunteer"
          as="p"
          className="mt-8 text-[10px] text-muted-foreground dark:text-ink-muted-on-dark font-black uppercase tracking-widest"
        >
          100% Volunteer Powered • Grassroots Community Funded
        </DataPoint>
      </div>
    </div>
  );
}
