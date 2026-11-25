import { NextResponse } from 'next/server';
import { isE2EMode } from '@/lib/e2e-mode';
import { env } from '@/lib/env';
import { processPendingDiscoveries } from '@/lib/ice-crawl-intake';
import { getIceCrawlStore } from '@/lib/ice-crawl-store';

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

  if (isE2EMode()) return json({ ok: true, skipped: 'test-build' });

  const store = getIceCrawlStore();
  if (!store) return json({ ok: false, code: 'crawler-not-configured' }, 503);

  const requested = Number(new URL(req.url).searchParams.get('limit') ?? '');
  const limit =
    Number.isFinite(requested) && requested > 0 ? Math.min(20, Math.floor(requested)) : 8;

  try {
    const summary = await processPendingDiscoveries(store, {
      limit,
      // Leave headroom for the last candidate's AI call (25s) and one image
      // download (8s). The function ceiling is 60s; a 45s deadline could
      // start that work at 44s and turn the run into a 504.
      deadline: Date.now() + 32_000,
    });
    return json({ ok: true, ...summary });
  } catch {
    return json({ ok: false, code: 'intake-failed' }, 500);
  }
}
