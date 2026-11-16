'use client';

import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';

export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { dataPoints } = useDataPoints('account');

  return (
    <div className="civic-page bg-background min-h-screen pt-(--header-clearance) pb-16 text-foreground transition-colors duration-300">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <DataPoint
          as="h1"
          name="account.error.title"
          initialData={dataPoints}
          className="mb-4 font-display text-2xl font-semibold tracking-[-0.02em] text-foreground"
        >
          Something went wrong
        </DataPoint>
        <p className="text-muted-foreground text-sm mb-2">{error.message}</p>
        {error.digest && (
          <p className="text-muted-foreground text-xs font-mono mb-6">Digest: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="cursor-pointer rounded-sm bg-primary px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-primary-dark dark:bg-primary-bright dark:hover:bg-primary-light"
        >
          <DataPoint as="span" name="account.error.retry" initialData={dataPoints}>
            Try again
          </DataPoint>
        </button>
      </div>
    </div>
  );
}
