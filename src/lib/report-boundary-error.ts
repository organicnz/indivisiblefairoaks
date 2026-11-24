import { publicEnv } from '@/lib/public-env';

/**
 * Report an error from a Client Component error boundary.
 *
 * Both channels are loaded on demand. Importing `@/lib/error-report` statically
 * pulled Zod into every route's first-load bundle, so the beacon reporter now
 * lives in the Zod-free `error-report-client` module, and importing
 * `@sentry/nextjs` statically pulled the Sentry browser runtime with it — for
 * code that only runs after a crash. The first-party beacon is attempted even
 * when Sentry is not configured, preserving the existing dual-reporting
 * contract. Every failure here is swallowed: telemetry must never replace the
 * recovery UI.
 */
export function reportBoundaryError(
  error: unknown,
  extras: { digest?: string; componentStack?: string } = {}
): void {
  void import('@/lib/error-report-client')
    .then(({ reportClientError }) => reportClientError(error, extras))
    .catch(() => {});

  if (!publicEnv.NEXT_PUBLIC_SENTRY_DSN) return;
  void import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error)).catch(() => {});
}
