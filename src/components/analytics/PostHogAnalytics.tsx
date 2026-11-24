'use client';

import { useEffect } from 'react';
import { initAnalytics } from '@/lib/posthog';

/**
 * Initialises PostHog for the named journey events captured by
 * `captureAnalyticsEvent`.
 *
 * Pageviews are Vercel Analytics' job. Sending a second `$pageview` here would
 * duplicate that data and add another per-navigation third-party request.
 *
 * There is no session replay: the SDK is initialised with recording disabled,
 * and no code path starts it. Do Not Track and Global Privacy Control are
 * checked before the SDK loads in `@/lib/posthog`; they do not affect the
 * separate Vercel Analytics and Speed Insights beacons.
 *
 * It renders nothing. It sits beside `<Analytics />` and `<SpeedInsights />` in
 * the root layout, inside the same `NEXT_E2E_BUILD` guard, so a bundle built to
 * be tested in a browser files no events against the PostHog project.
 */
export function PostHogAnalytics() {
  useEffect(() => {
    void initAnalytics();
  }, []);

  return null;
}

export default PostHogAnalytics;
