import { connection, NextResponse } from 'next/server';
import type { RapidFeed } from '@/components/ice-alerts/rapid-types';
import { getRapidFeed } from '@/lib/ice-rapid-feed';
import { getRapidPublicCases } from '@/lib/queries/ice-public-cases';

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
  const [feed, publicCases] = await Promise.all([
    getRapidFeed(),
    getRapidPublicCases(),
  ]);
  const payload: RapidFeed = { ...feed, publicCases };

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
