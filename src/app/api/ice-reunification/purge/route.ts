import { NextResponse } from 'next/server';
import { isE2EMode } from '@/lib/e2e-mode';
import { env } from '@/lib/env';
import {
  deleteReunificationRequests,
  getReunificationStore,
  listExpiredReunificationRequests,
  REUNIFICATION_BUCKET,
} from '@/lib/ice-reunification';

export const maxDuration = 30;

const NO_STORE = { 'Cache-Control': 'no-store' };
const BATCH_SIZE = 100;

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
  if (allowed === null) {
    return json({ ok: false, code: 'cron-not-configured' }, 503);
  }
  if (!allowed) return json({ ok: false, code: 'unauthorized' }, 401);

  if (isE2EMode()) {
    return json({ ok: true, skipped: 'test-build', deleted: 0 });
  }

  const store = getReunificationStore();
  if (!store) return json({ ok: false, code: 'store-not-configured' }, 503);

  try {
    const expired = await listExpiredReunificationRequests(store, BATCH_SIZE);
    if (expired.length === 0) {
      return json({ ok: true, deleted: 0, photos: 0 });
    }

    const paths = expired
      .map((row) => row.photo_path)
      .filter((path): path is string => Boolean(path));

    if (paths.length > 0) {
      const { error } = await store.storage.from(REUNIFICATION_BUCKET).remove(paths);
      if (error) throw new Error(`reunification photo purge failed: ${error.message}`);
    }

    await deleteReunificationRequests(
      store,
      expired.map((row) => row.id)
    );

    return json({ ok: true, deleted: expired.length, photos: paths.length });
  } catch (error) {
    console.error(
      '[ice-reunification] purge failed',
      error instanceof Error ? error.message : 'unknown error'
    );
    return json({ ok: false, code: 'server-error' }, 500);
  }
}
