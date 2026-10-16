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
    <div className="bg-white min-h-screen pt-(--header-h) pb-16">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <DataPoint
          as="h1"
          name="account.error.title"
          initialData={dataPoints}
          className="text-2xl font-black text-secondary uppercase mb-4"
        >
          Something went wrong
        </DataPoint>
        <p className="text-slate-500 text-sm mb-2">{error.message}</p>
        {error.digest && (
          <p className="text-slate-400 text-xs font-mono mb-6">Digest: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="bg-primary text-secondary font-black text-xs uppercase tracking-widest px-6 py-3 rounded-full cursor-pointer"
        >
          <DataPoint as="span" name="account.error.retry" initialData={dataPoints}>
            Try again
          </DataPoint>
        </button>
      </div>
    </div>
  );
}
