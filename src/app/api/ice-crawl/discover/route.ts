import { NextResponse } from 'next/server';
import { discoverNationwideIceCandidates } from '@/lib/ice-crawl-discovery';
import {
  getIceCrawlStore,
  insertIceCrawlDiscoveries,
} from '@/lib/ice-crawl-store';
import { isE2EMode } from '@/lib/e2e-mode';
import { env } from '@/lib/env';

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
    return json({ ok: true, skipped: 'test-build', candidates: 0, queued: 0 });
  }

  try {
    const store = getIceCrawlStore();
    if (!store) return json({ ok: false, code: 'crawler-not-configured' }, 503);
    const discovery = await discoverNationwideIceCandidates();
    const queued = await insertIceCrawlDiscoveries(store, discovery.candidates);
    return json({
      ok: true,
      query: discovery.query,
      provider: discovery.provider,
      providers: discovery.providers,
      found: discovery.candidates.length,
      queued,
      errors: discovery.errors,
    });
  } catch {
    return json({ ok: false, code: 'crawler-not-configured' }, 503);
  }
}
