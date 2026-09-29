import { XCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = privateMetadata({
  title: 'Checkout Cancelled',
  description:
    'Your checkout session was cancelled. No charges were made. Your items are still saved in your cart for your next purchase.',
  path: '/cancel',
});

export default function CancelPage() {
  return (
    <div className="min-h-[80vh] bg-white flex items-center justify-center px-4 pt-(--header-h) pb-16">
      <div className="max-w-md w-full bg-slate-50 p-10 rounded-3xl shadow-sm text-center border border-slate-100">
        <div className="bg-rose-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
          <XCircle className="w-12 h-12 text-rose-600" strokeWidth={3} />
        </div>
        <h1 className="text-3xl font-black text-secondary uppercase tracking-tight mb-4">
          Checkout Cancelled
        </h1>
        <p className="text-slate-600 mb-10 font-medium leading-relaxed">
          No charges were made. Your gear is still in the cart waiting for your next adventure.
        </p>
        <div className="flex flex-col gap-4">
          <Link
            href="/cart"
            className="w-full inline-block py-5 px-8 bg-secondary hover:bg-primary text-white font-black rounded-full transition-all uppercase tracking-[0.2em] text-sm shadow-xl shadow-secondary/10"
          >
            Review Cart
          </Link>
          <Link
            href="/products"
            className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-secondary transition-colors"
          >
            Back to Store
          </Link>
        </div>
      </div>
    </div>
  );
}

import { privateMetadata } from '@/lib/metadata';
