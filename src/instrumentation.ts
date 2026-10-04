import * as Sentry from '@sentry/nextjs';

// Next.js App Router server instrumentation entrypoint. `register()` runs
// once per server runtime; the branch selects which Sentry config loads.
// `onRequestError` captures Server Component, middleware and proxy errors.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
