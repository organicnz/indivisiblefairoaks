import * as Sentry from '@sentry/nextjs';
import { env } from '@/lib/env';

// Server-side error monitoring. See instrumentation-client.ts for the
// coexistence contract with error_reports and for why tracing stays sampled,
// replay/feedback stay off, and user data collection stays off.
Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  dataCollection: { userInfo: false },
});
