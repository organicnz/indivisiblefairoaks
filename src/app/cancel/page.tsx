import { XCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';
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
    <div className="min-h-[80vh] bg-white flex items-center justify-center px-4 pt-(--header-h) pb-16">
      <div className="max-w-md w-full bg-slate-50 p-10 rounded-3xl shadow-sm text-center border border-slate-100">
        <div className="bg-rose-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
          <XCircle className="w-12 h-12 text-rose-600" strokeWidth={3} />
        </div>
        <DataPoint
          name="cancel.hero.title"
          as="h1"
          initialData={dataPoints}
          className="text-3xl font-black text-secondary uppercase tracking-tight mb-4"
        >
          Checkout Cancelled
        </DataPoint>
        <DataPoint
          name="cancel.hero.desc"
          as="p"
          initialData={dataPoints}
          className="text-slate-600 mb-10 font-medium leading-relaxed"
        >
          No charges were made. Your items are still saved in your cart waiting for your next visit.
        </DataPoint>
        <div className="flex flex-col gap-4">
          <Link
            href="/cart"
            className="w-full inline-block py-5 px-8 bg-secondary hover:bg-primary text-white font-black rounded-full transition-all uppercase tracking-[0.2em] text-sm shadow-xl shadow-secondary/10"
          >
            <DataPoint name="cancel.btn.cart" as="span" initialData={dataPoints}>
              Review Cart
            </DataPoint>
          </Link>
          <Link
            href="/products"
            className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-secondary transition-colors"
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
