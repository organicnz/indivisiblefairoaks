import * as Sentry from '@sentry/nextjs';

// Next.js App Router server instrumentation entrypoint. `register()` runs
// once per server runtime; the branch selects which Sentry config loads.
// `onRequestError` captures Server Component, route-handler and middleware
// errors. The middleware is the Edge-runtime one — see middleware.ts for why
// this project stays on the `middleware` file convention rather than `proxy`.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
