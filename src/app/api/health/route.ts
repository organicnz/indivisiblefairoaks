import { connection, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { evaluateIceCrawlHealth, type IceCrawlHealthRow } from '@/lib/ice-crawl-health';

/**
 * Read the crawl health view with the service key. The view is intentionally
 * not browser-readable: alert messages are operational state, not public data.
 * A missing view or key reports `unknown` instead of failing site health.
 */
async function readCrawlHealth(): Promise<IceCrawlHealthRow | null> {
  const key = env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/ice_crawl_health?select=*`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as IceCrawlHealthRow[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Uptime-monitor anchor. Always evaluated at request time (connection()
 * opts out of prerendering under Cache Components) so the response reflects
 * live conditions, not build-time state.
 */
export async function GET() {
  await connection();

  const startedAt = Date.now();
  // Start the crawl-health read alongside the database probe; neither gates
  // the other. Site availability (`status`) stays database-only, while a stale
  // scheduled crawl is reported as `crawl.status: "stale"` plus its alert.
  const crawlHealthPromise = readCrawlHealth();
  let db: 'up' | 'degraded' | 'down' = 'down';
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/events?select=slug&limit=1`, {
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    db = res.ok ? 'up' : 'degraded';
  } catch {
    db = 'down';
  }

  const crawlHealth = evaluateIceCrawlHealth(await crawlHealthPromise);
  const latencyMs = Date.now() - startedAt;
  const status = db === 'up' ? 'ok' : 'degraded';

  return NextResponse.json(
    {
      status,
      checks: { database: db },
      latencyMs,
      timestamp: new Date().toISOString(),
      // Which artifact answered, in one request: the commit Vercel built and
      // when it built it, both inlined at build time. Checking the live SHA
      // used to mean the GitHub deployments API plus reading page copy.
      deployment: {
        commit: env.DEPLOYMENT_COMMIT_SHA,
        builtAt: env.DEPLOYMENT_BUILT_AT,
      },
      // The last successful scheduled tick for each pipeline, from the same
      // view the watchdog reads. `unknown` means the view was unavailable, not
      // that the crawler is healthy.
      crawl: {
        status: crawlHealth.status,
        lastSuccessfulTickAt: crawlHealth.lastSuccessfulTickAt,
        sourceCrawl: crawlHealth.sourceCrawl,
        discovery: crawlHealth.discovery,
        alerts: crawlHealth.alerts,
        checkedAt: crawlHealth.checkedAt,
      },
    },
    {
      status: status === 'ok' ? 200 : 503,
      headers: {
        // Monitors and proxies must see the live check, never a cached
        // 200 from a previous isolate.
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}
