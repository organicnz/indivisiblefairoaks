import { NextResponse } from 'next/server';
import { isE2EMode } from '@/lib/e2e-mode';
import {
  ICE_ALERT_PURGE_BATCH_SIZE,
  iceAlertRetentionCutoffs,
} from '@/lib/ice-alert-retention';
import {
  deleteSubscribers,
  getIceAlertStore,
  listExpiredPendingSubscribers,
  listExpiredUnsubscribedSubscribers,
} from '@/lib/ice-alert-store';
import { env } from '@/lib/env';

export const maxDuration = 30;

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
  if (allowed === null) {
    return json({ ok: false, code: 'cron-not-configured' }, 503);
  }
  if (!allowed) return json({ ok: false, code: 'unauthorized' }, 401);

  if (isE2EMode()) {
    return json({ ok: true, skipped: 'test-build', deleted: 0 });
  }

  const store = getIceAlertStore();
  if (!store) return json({ ok: false, code: 'store-not-configured' }, 503);

  try {
    const cutoffs = iceAlertRetentionCutoffs();
    const [pending, unsubscribed] = await Promise.all([
      listExpiredPendingSubscribers(
        store,
        cutoffs.pendingBefore,
        ICE_ALERT_PURGE_BATCH_SIZE
      ),
      listExpiredUnsubscribedSubscribers(
        store,
        cutoffs.unsubscribedBefore,
        ICE_ALERT_PURGE_BATCH_SIZE
      ),
    ]);

    const ids = [
      ...new Set([...pending, ...unsubscribed].map((row) => row.id)),
    ];
    await deleteSubscribers(store, ids);

    return json({
      ok: true,
      deleted: ids.length,
      pending: pending.length,
      unsubscribed: unsubscribed.length,
    });
  } catch {
    return json({ ok: false, code: 'server-error' }, 500);
  }
}
