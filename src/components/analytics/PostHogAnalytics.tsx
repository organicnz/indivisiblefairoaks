'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { ANALYTICS_CONSENT_KEY, initAnalytics, syncAnalyticsReplay } from '@/lib/posthog';

/**
 * Mounts PostHog session replay, one navigation at a time.
 *
 * The whole integration is a single behaviour — *initialise once, then keep the
 * recording decision in step with the route* — and this component is only that
 * binding. Every rule it applies lives in `@/lib/posthog`, where it is unit
 * tested without a browser.
 *
 * It renders nothing. It sits beside `<Analytics />` and `<SpeedInsights />` in
 * the root layout, inside the same `NEXT_E2E_BUILD` guard, so a bundle built to
 * be tested in a browser files no events against the PostHog project.
 *
 * The pathname is the effect's dependency rather than an interval or a router
 * event: an App Router navigation re-renders this component with the new path,
 * which is the moment the recording decision can change (`/admin` stops it, and
 * leaving `/admin` may start it again).
 */
export function PostHogAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    // A navigation can unmount this before the lazily-imported SDK resolves.
    // Capturing the pageview of a route the visitor already left would attach
    // it to the wrong page, and the replay would show the wrong thing.
    let cancelled = false;

    void initAnalytics().then((client) => {
      if (!client || cancelled) return;
      syncAnalyticsReplay(pathname);
      client.capture('$pageview', { $current_url: window.location.href });
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // A decision made in another tab applies here too: localStorage is shared,
  // and the last thing a visitor expects is to withdraw consent in one tab and
  // still be recorded in the other.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== ANALYTICS_CONSENT_KEY) return;
      void initAnalytics().then((client) => {
        if (!client) return;
        if (event.newValue === 'granted') client.opt_in_capturing();
        else client.stopSessionRecording();
        syncAnalyticsReplay(window.location.pathname);
      });
    }

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return null;
}

export default PostHogAnalytics;
