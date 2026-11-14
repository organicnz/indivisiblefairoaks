'use client';

import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { reportClientError } from '@/lib/error-report';

/**
 * The composer's route-level failure surface.
 *
 * A missing Supabase configuration, an expired session, or a failed server read
 * used to reach the browser as the generic app error page. That page does not
 * explain that the public site is unaffected or that the operator can go back
 * to the content editor, and in development it can leak the configuration
 * message. Keep the recovery actions and report the diagnostic through the
 * existing error pipeline instead of printing it into the page.
 */
export default function ComposerWorkspaceError({
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
    <div
      data-testid="compose-error"
      role="alert"
      className="min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom))] pt-(--header-clearance) text-foreground"
    >
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="border-b-2 border-foreground/15 py-10">
          <p className="civic-kicker">Composer workspace</p>
          <h1 className="mt-3 text-4xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-5xl">
            The composer could not open.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            The public site is unaffected. The workspace could not read or start this row — retry
            the request, or return to the content editor and open it again from there.
          </p>

          {error.digest ? (
            <p className="mt-4 font-mono text-[11px] text-muted-foreground">
              Reference: {error.digest}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 bg-primary px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <RefreshCw size={13} aria-hidden="true" />
              Retry
            </button>
            <Link
              href="/admin/content"
              className="inline-flex items-center gap-1.5 border border-border bg-surface-card px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft size={13} aria-hidden="true" />
              Back to content
            </Link>
          </div>

          <p className="mt-8 flex items-start gap-2 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            If this keeps happening, check that the deployment&apos;s Supabase environment and the
            signed-in account still have access to this row.
          </p>
        </div>
      </div>
    </div>
  );
}
