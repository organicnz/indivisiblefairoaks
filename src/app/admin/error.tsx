'use client';

import * as Sentry from '@sentry/nextjs';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { reportClientError } from '@/lib/error-report';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, { digest: error.digest });
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="py-12 px-4 max-w-2xl mx-auto text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
        <AlertCircle size={32} />
      </div>
      <h2 className="text-2xl font-black text-foreground uppercase tracking-tight mb-2">
        Admin Portal Notice
      </h2>
      <p className="text-sm font-medium text-muted-foreground mb-4 max-w-md mx-auto">
        An error occurred while loading this administrative view. Your session remains secure.
      </p>
      {error.message && (
        <div className="mb-6 p-4 rounded-xl bg-surface-muted border border-border text-left font-mono text-xs text-foreground/80 overflow-x-auto">
          <p className="font-bold text-destructive mb-1">Error Details:</p>
          <p className="break-words">{error.message}</p>
          {error.digest && (
            <p className="text-[11px] text-muted-foreground mt-2">Digest: {error.digest}</p>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-primary-light transition-colors shadow-xs cursor-pointer"
        >
          <RefreshCw size={14} />
          Try Again
        </button>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-6 py-3 bg-surface-card text-foreground hover:bg-surface-muted border border-border text-xs font-black uppercase tracking-wider rounded-xl transition-colors shadow-xs"
        >
          Admin Home
        </Link>
      </div>
    </div>
  );
}
