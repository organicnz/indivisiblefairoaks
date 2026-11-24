import { publicEnv } from '@/lib/public-env';

/**
 * Client-side error monitoring for the indivisiblefairoaks-web project.
 *
 * The SDK is loaded asynchronously rather than imported statically. A static
 * import put the Sentry browser runtime in the initial JavaScript of every
 * route — more than a third of the shared first-load bundle — even though error
 * monitoring is never needed to paint a page. The import starts immediately at
 * boot, so the SDK is ready before ordinary interaction; a failure that occurs
 * in the few milliseconds before it resolves is still covered by the
 * first-party `error_reports` beacon in the error boundaries.
 *
 * Error monitoring only, deliberately. No Session Replay (session recording on
 * a constituent-facing organising site, plus the runtime overhead), no User
 * Feedback widget (a bottom-right button would collide with the WALL-E launcher
 * and the command palette). No tunneling either: routing events through our own
 * server costs Fluid CPU to dodge ad blockers, and a blocked report is
 * acceptable loss here.
 *
 * `dataCollection.userInfo` stays off: IP addresses and request bodies from
 * constituents do not leave the database this project already holds.
 *
 * This coexists with, and does not replace, the first-party error_reports table
 * (`reportClientError` in src/lib/error-report.ts). That table is admin-visible,
 * rate-limited, and RLS-scoped; Sentry carries source-mapped stack traces and
 * request context for debugging. Both fire from the error boundaries — neither
 * is the other's fallback.
 */
const sentryPromise = publicEnv.NEXT_PUBLIC_SENTRY_DSN
  ? import('@sentry/nextjs').then((Sentry) => {
      Sentry.init({
        dsn: publicEnv.NEXT_PUBLIC_SENTRY_DSN,
        // Absent DSN disables the SDK. Local dev and the CI/e2e builds carry no
        // DSN on purpose, so neither can file events against the production
        // project — the same reason CRM sends refuse in e2e builds.
        tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
        dataCollection: { userInfo: false },
      });
      return Sentry;
    })
  : null;

function withSentry(callback: (Sentry: typeof import('@sentry/nextjs')) => void): void {
  if (!sentryPromise) return;
  void sentryPromise.then(callback).catch(() => {
    // Monitoring must never become an error of its own.
  });
}

export function onRouterTransitionStart(href: string, navigationType: string): void {
  withSentry((Sentry) => Sentry.captureRouterTransitionStart(href, navigationType));
}
