import { NextResponse } from 'next/server';
import { isE2EMode } from '@/lib/e2e-mode';
import { env } from '@/lib/env';
import { crawlAllIceSources } from '@/lib/ice-crawl';
import { discoverNationwideIceCandidates } from '@/lib/ice-crawl-discovery';
import { getIceCrawlStore, insertIceCrawlDiscoveries } from '@/lib/ice-crawl-store';

export const maxDuration = 60;

const NO_STORE = { 'Cache-Control': 'no-store' };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function authorized(req: Request) {
  const secret = env.CRON_SECRET;
  if (!secret) return null;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  const allowed = authorized(req);
  if (allowed === null) return json({ ok: false, code: 'cron-not-configured' }, 503);
  if (!allowed) return json({ ok: false, code: 'unauthorized' }, 401);

  if (isE2EMode()) {
    return json({ ok: true, skipped: 'test-build', sources: 0 });
  }

  // A cron tick can ask for the approved-source crawl alone, bounded to a few
  // sources, so a 60-second function budget covers it. The default (no query)
  // keeps the original full run — discovery plus every source — for manual and
  // legacy jobs.
  const params = new URL(req.url).searchParams;
  const sourcesOnly = params.get('mode') === 'sources';
  const requestedLimit = Number(params.get('limit') ?? '');
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(10, Math.floor(requestedLimit))
      : undefined;

  let discovery: {
    provider: string;
    providers: string[];
    found: number;
    queued: number;
    errors: string[];
  } | null = null;
  try {
    const store = sourcesOnly ? null : getIceCrawlStore();
    if (store) {
      const candidates = await discoverNationwideIceCandidates({ forceGkg: true });
      discovery = {
        provider: candidates.provider,
        providers: candidates.providers,
        found: candidates.candidates.length,
        queued: await insertIceCrawlDiscoveries(store, candidates.candidates),
        errors: candidates.errors,
      };
    }
  } catch {
    // A discovery outage must not stop the approved-source crawl.
    discovery = {
      provider: 'none',
      providers: [],
      found: 0,
      queued: 0,
      errors: ['Nationwide discovery failed.'],
    };
  }

  try {
    const results = await crawlAllIceSources({ limit });
    return json({
      ok: true,
      mode: sourcesOnly ? 'sources' : 'all',
      limit: limit ?? null,
      discovery,
      sources: results.length,
      results,
    });
  } catch {
    return json({ ok: false, code: 'crawler-not-configured' }, 503);
  }
}
