import * as Sentry from '@sentry/nextjs';
import { env } from '@/lib/env';

// Edge-runtime error monitoring (middleware). Same contract as
// instrumentation-client.ts: coexists with error_reports, sampled traces,
// no replay/feedback, no user data collection.
Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  dataCollection: { userInfo: false },
});
