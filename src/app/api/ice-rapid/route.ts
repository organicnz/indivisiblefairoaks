import { connection, NextResponse } from 'next/server';
import { getRapidFeed } from '@/lib/ice-rapid-feed';

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
  const feed = await getRapidFeed();

  return NextResponse.json(feed, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
