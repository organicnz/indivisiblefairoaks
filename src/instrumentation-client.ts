import * as Sentry from '@sentry/nextjs';
import { env } from '@/lib/env';

// Client-side error monitoring for the indivisiblefairoaks-web project.
//
// This coexists with, and does not replace, the first-party error_reports
// table (`reportClientError` in src/lib/error-report.ts). That table is
// admin-visible, rate-limited, and RLS-scoped; Sentry carries
// source-mapped stack traces and request context for debugging. Both fire
// from the error boundaries — neither is the other's fallback.
//
// Error monitoring only, deliberately. No Session Replay (session recording
// on a constituent-facing organising site, plus the runtime overhead), no
// User Feedback widget (a bottom-right button would collide with the WALL-E
// launcher and the command palette). No tunneling either: routing events
// through our own server costs Fluid CPU to dodge ad blockers, and a blocked
// report is acceptable loss here.
//
// `dataCollection.userInfo` stays off: IP addresses and request bodies from
// constituents do not leave the database this project already holds.
Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  // Absent DSN disables the SDK. Local dev and the CI/e2e builds carry no
  // DSN on purpose, so neither can file events against the production
  // project — the same reason CRM sends refuse in e2e builds.
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  dataCollection: { userInfo: false },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
