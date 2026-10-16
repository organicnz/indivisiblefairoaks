'use client';

import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { useEffect } from 'react';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';
import { reportClientError } from '@/lib/error-report';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { dataPoints } = useDataPoints('error');

  useEffect(() => {
    reportClientError(error, { digest: error.digest });
    // Same dual-reporting contract as global-error.tsx: first-party log plus
    // source-mapped Sentry trace. No-ops when no DSN is set.
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-[70vh] bg-background text-foreground flex items-center justify-center px-4 pt-(--header-h) pb-16">
      <div className="max-w-md w-full bg-surface-muted p-10 rounded-3xl shadow-sm text-center border border-border">
        <div className="bg-primary/15 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
          <DataPoint
            as="span"
            name="error.badge"
            initialData={dataPoints}
            className="text-4xl font-black text-secondary"
          >
            !
          </DataPoint>
        </div>
        <DataPoint
          as="h1"
          name="error.title"
          initialData={dataPoints}
          className="text-3xl font-black text-secondary uppercase tracking-tight mb-4"
        >
          Something Snapped
        </DataPoint>
        <DataPoint
          as="p"
          name="error.description"
          initialData={dataPoints}
          className="text-muted-foreground mb-10 font-medium leading-relaxed"
        >
          We encountered an unexpected issue while loading this page. Please try again, or reach out
          to our team if the issue persists.
        </DataPoint>
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={reset}
            className="w-full py-5 px-8 bg-secondary hover:bg-primary text-white font-black rounded-full transition-all uppercase tracking-[0.2em] text-sm cursor-pointer"
          >
            <DataPoint as="span" name="error.btn.retry" initialData={dataPoints}>
              Try Again
            </DataPoint>
          </button>
          <Link
            href="/contact"
            className="text-xs font-black text-muted-foreground uppercase tracking-widest hover:text-secondary transition-colors"
          >
            <DataPoint as="span" name="error.btn.contact" initialData={dataPoints}>
              Contact Support
            </DataPoint>
          </Link>
        </div>
      </div>
    </div>
  );
}
