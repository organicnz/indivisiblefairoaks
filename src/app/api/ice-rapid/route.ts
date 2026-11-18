import { connection, NextResponse } from 'next/server';
import type { RapidFeed } from '@/components/ice-alerts/rapid-types';
import { getRapidFeedResult, hasUsableRapidFeed } from '@/lib/ice-rapid-feed';
import { getRapidPublicCases } from '@/lib/queries/ice-public-cases';

// Cold source resolution is bounded in the feed module; this leaves headroom
// for the optional public-case query and the durable cache write.
export const maxDuration = 30;

/**
 * Public, normalized rapid-response feed.
 *
 * The upstream community export is fetched and sanitized on the server so raw
 * addresses, comments, plates, and identities never reach the browser.
 */
export async function GET() {
  // Keep the live feed out of the build-time prerender pass. The response has
  // its own shared-cache header below.
  await connection();
  const [{ feed, meta }, publicCases] = await Promise.all([
    getRapidFeedResult(),
    getRapidPublicCases(),
  ]);
  const payload: RapidFeed = { ...feed, publicCases };
  const usable = hasUsableRapidFeed(feed);

  return NextResponse.json(payload, {
    status: usable ? 200 : 503,
    headers: {
      'X-ICE-Feed-Version': '2',
      // Provenance only: these values expose no upstream body, URL, or credential.
      'X-ICE-Feed-Source': meta.source,
      'X-ICE-Feed-Age': String(meta.ageSeconds),
      'X-ICE-Feed-Cache-Age': String(meta.cacheAgeSeconds),
      // The upstream community export is nightly, so a low-traffic visit must
      // not wait through a cold upstream fetch. Keep serving the last good
      // payload while revalidating in the background, and keep it available
      // even if the refresh fails.
      'Cache-Control': usable
        ? 'public, s-maxage=60, stale-while-revalidate=86400, stale-if-error=86400'
        : 'no-store',
      ...(usable ? {} : { 'Retry-After': '5' }),
    },
  });
}
