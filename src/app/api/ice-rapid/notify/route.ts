import { NextResponse } from 'next/server';
import { isE2EMode } from '@/lib/e2e-mode';
import { sendIceAlertSurge } from '@/lib/ice-alert-email';
import { sendIceAlertPush } from '@/lib/ice-alert-push';
import {
  claimSurgeEvents,
  getIceAlertStore,
  listConfirmedSubscribers,
  markSurgeNotified,
  updateSubscriber,
  type IceAlertSubscriber,
} from '@/lib/ice-alert-store';
import { getRapidFeed } from '@/lib/ice-rapid-feed';
import {
  computeRapidSurges,
  surgeMatchesAudience,
  type RapidSurge,
} from '@/lib/ice-rapid-surges';
import { env } from '@/lib/env';

export const maxDuration = 60;

const COOLDOWN_MS = 30 * 60 * 1_000;
const MAX_DELIVERIES = 80;
const CHUNK_SIZE = 8;
const NO_STORE = { 'Cache-Control': 'no-store' };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function authorized(req: Request) {
  const secret = env.CRON_SECRET;
  if (!secret) return null;
  const header = req.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

function subscriberAudience(subscriber: IceAlertSubscriber) {
  return { stateCode: subscriber.state_code, city: subscriber.city };
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export async function POST(req: Request) {
  const allowed = authorized(req);
  if (allowed === null) {
    return json({ ok: false, code: 'cron-not-configured' }, 503);
  }
  if (!allowed) return json({ ok: false, code: 'unauthorized' }, 401);

  if (isE2EMode()) {
    return json({ ok: true, skipped: 'test-build', deliveries: 0 });
  }

  const store = getIceAlertStore();
  if (!store) return json({ ok: false, code: 'store-not-configured' }, 503);

  try {
    const feed = await getRapidFeed();
    const allSurges = computeRapidSurges(feed.alerts, Date.now());
    if (allSurges.length === 0) {
      return json({ ok: true, surges: 0, deliveries: 0 });
    }

    const pending = await claimSurgeEvents(store, allSurges);
    if (pending.length === 0) {
      return json({ ok: true, surges: allSurges.length, deliveries: 0 });
    }

    const byKey = new Map(allSurges.map((surge) => [surge.key, surge]));
    const pendingSurges = pending
      .map((event) => byKey.get(event.surge_key))
      .filter((surge): surge is RapidSurge => Boolean(surge));

    const subscribers = await listConfirmedSubscribers(store);
    const now = Date.now();
    const deliveries: { subscriber: IceAlertSubscriber; surges: RapidSurge[] }[] = [];

    for (const subscriber of subscribers) {
      if (
        subscriber.last_notified_at &&
        now - Date.parse(subscriber.last_notified_at) < COOLDOWN_MS
      ) {
        continue;
      }

      const matching = pendingSurges.filter((surge) =>
        surgeMatchesAudience(surge, subscriberAudience(subscriber))
      );
      if (matching.length === 0) continue;

      deliveries.push({ subscriber, surges: matching });
      if (deliveries.length >= MAX_DELIVERIES) break;
    }

    let emailSent = 0;
    let emailFailed = 0;
    let pushSent = 0;
    let pushFailed = 0;
    const deliveredTo = new Map<string, Set<string>>();
    const attemptedTo = new Map<string, Set<string>>();

    for (const batch of chunks(deliveries, CHUNK_SIZE)) {
      await Promise.all(
        batch.map(async ({ subscriber, surges }) => {
          let delivered = false;
          const first = surges[0];

          for (const surge of surges) {
            const seen = attemptedTo.get(surge.key) ?? new Set<string>();
            seen.add(subscriber.id);
            attemptedTo.set(surge.key, seen);
          }

          if (subscriber.email_opt_in && subscriber.email) {
            const result = await sendIceAlertSurge({
              email: subscriber.email,
              unsubscribeToken: subscriber.unsubscribe_token,
              stateCode: subscriber.state_code,
              city: subscriber.city,
              surges,
            });
            if (result.ok) {
              emailSent += 1;
              delivered = true;
            } else {
              emailFailed += 1;
            }
          }

          if (
            subscriber.push_opt_in &&
            subscriber.push_subscription &&
            first
          ) {
            const result = await sendIceAlertPush(subscriber.push_subscription, {
              title:
                surges.length === 1
                  ? `ICE surge: ${first.shortLabel}`
                  : `ICE surge watch: ${surges.length} areas`,
              body:
                surges.length === 1
                  ? first.label
                  : `${first.label} Open the map for all areas.`,
              url: first.alertIds[0]
                ? `/ice-alerts?alert=${encodeURIComponent(first.alertIds[0])}`
                : '/ice-alerts',
              tag: first.key,
            });

            if (result.ok) {
              pushSent += 1;
              delivered = true;
            } else {
              pushFailed += 1;
              if (result.gone) {
                await updateSubscriber(store, subscriber.id, {
                  push_opt_in: false,
                  push_subscription: null,
                }).catch(() => undefined);
              }
            }
          }

          if (delivered) {
            for (const surge of surges) {
              const seen = deliveredTo.get(surge.key) ?? new Set<string>();
              seen.add(subscriber.id);
              deliveredTo.set(surge.key, seen);
            }

            await updateSubscriber(store, subscriber.id, {
              last_notified_at: new Date().toISOString(),
              last_surge_key: first?.key ?? null,
            }).catch(() => undefined);
          }
        })
      );
    }

    for (const event of pending) {
      const count = deliveredTo.get(event.surge_key)?.size ?? 0;
      const attempts = attemptedTo.get(event.surge_key)?.size ?? 0;
      // A temporary Resend/VAPID outage must not consume the surge. Retry it
      // while it is still in the future window; if nobody matched, close it so
      // an empty audience does not leave a permanent pending row.
      if (count > 0 || attempts === 0) {
        await markSurgeNotified(store, event.surge_key, count).catch(() => undefined);
      }
    }

    return json({
      ok: true,
      surges: allSurges.length,
      pending: pending.length,
      matched: deliveries.length,
      emailSent,
      emailFailed,
      pushSent,
      pushFailed,
    });
  } catch {
    return json({ ok: false, code: 'notify-failed' }, 500);
  }
}
