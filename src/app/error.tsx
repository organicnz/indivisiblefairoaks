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
    <div className="civic-page flex min-h-[70vh] items-center justify-center overflow-hidden bg-background px-4 pb-16 pt-(--header-h) text-foreground">
      <div className="relative z-10 w-full max-w-md border border-border bg-surface-card p-10 text-center">
        <div className="mx-auto mb-8 flex size-24 items-center justify-center rounded-full bg-primary/15">
          <DataPoint
            as="span"
            name="error.badge"
            initialData={dataPoints}
            className="text-4xl font-semibold text-primary-ink"
          >
            !
          </DataPoint>
        </div>
        <DataPoint
          as="h1"
          name="error.title"
          initialData={dataPoints}
          className="mb-4 font-display text-3xl font-semibold tracking-[-0.03em]"
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
            className="min-h-11 w-full cursor-pointer border border-primary bg-primary px-8 py-4 text-sm font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <DataPoint as="span" name="error.btn.retry" initialData={dataPoints}>
              Try Again
            </DataPoint>
          </button>
          <Link
            href="/contact"
            className="min-h-11 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
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
