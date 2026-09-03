'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { reportClientError } from '@/lib/error-report';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, { digest: error.digest });
  }, [error]);

  return (
    <div className="min-h-[70vh] bg-white flex items-center justify-center px-4 pt-(--header-h) pb-16">
      <div className="max-w-md w-full bg-slate-50 p-10 rounded-3xl shadow-sm text-center border border-slate-100">
        <div className="bg-primary/15 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
          <span className="text-4xl font-black text-secondary">!</span>
        </div>
        <h1 className="text-3xl font-black text-secondary uppercase tracking-tight mb-4">
          Something Snapped
        </h1>
        <p className="text-slate-600 mb-10 font-medium leading-relaxed">
          That line broke under load — not our braid, just this page. Try again, and if it keeps
          happening, reach out and we&apos;ll sort it.
        </p>
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={reset}
            className="w-full py-5 px-8 bg-secondary hover:bg-primary text-white font-black rounded-full transition-all uppercase tracking-[0.2em] text-sm cursor-pointer"
          >
            Try Again
          </button>
          <Link
            href="/contact"
            className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-secondary transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
