import { XCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';
import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';
import { privateMetadata } from '@/lib/metadata';
import { getDataPoints } from '@/lib/queries/civic';

export const metadata: Metadata = privateMetadata({
  title: 'Checkout Cancelled',
  description:
    'Your checkout session was cancelled. No charges were made. Your items are still saved in your cart for your next purchase.',
  path: '/cancel',
});

export default async function CancelPage() {
  const dataPoints = await getDataPoints('cancel');

  return (
    <div className="relative overflow-hidden min-h-[80vh] bg-background flex items-center justify-center px-4 pt-(--header-h) pb-16 text-foreground transition-colors duration-300">
      <VgpuCivicConstellation className="pointer-events-none opacity-25" />
      <div className="relative z-10 max-w-md w-full bg-surface-card p-10 rounded-3xl shadow-raised text-center border border-border">
        <div className="bg-rose-100 dark:bg-rose-950/60 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
          <XCircle className="w-12 h-12 text-rose-600 dark:text-rose-400" strokeWidth={3} />
        </div>
        <DataPoint
          name="cancel.hero.title"
          as="h1"
          initialData={dataPoints}
          className="text-3xl font-black text-foreground uppercase tracking-tight mb-4"
        >
          Checkout Cancelled
        </DataPoint>
        <DataPoint
          name="cancel.hero.desc"
          as="p"
          initialData={dataPoints}
          className="text-muted-foreground mb-10 font-medium leading-relaxed"
        >
          No charges were made. Your items are still saved in your cart waiting for your next visit.
        </DataPoint>
        <div className="flex flex-col gap-4">
          <Link
            href="/cart"
            className="w-full inline-block py-5 px-8 bg-primary dark:bg-primary-bright hover:bg-primary-light text-white font-black rounded-full transition-all uppercase tracking-[0.2em] text-sm shadow-xl shadow-primary/20"
          >
            <DataPoint name="cancel.btn.cart" as="span" initialData={dataPoints}>
              Review Cart
            </DataPoint>
          </Link>
          <Link
            href="/products"
            className="text-xs font-black text-muted-foreground uppercase tracking-widest hover:text-primary dark:hover:text-primary-on-dark transition-colors"
          >
            <DataPoint name="cancel.btn.store" as="span" initialData={dataPoints}>
              Back to Store
            </DataPoint>
          </Link>
        </div>
      </div>
    </div>
  );
}
