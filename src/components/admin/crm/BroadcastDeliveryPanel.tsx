'use client';

import { useEffect, useState } from 'react';
import { getBroadcastEmailEvents, getBroadcastFollowUps } from '@/lib/actions/crm';
import type { BroadcastFollowUp, BroadcastMetrics, CRMBroadcastEmailEvent } from '@/types/crm';

/**
 * Recipient ledger and delivery events for one campaign.
 *
 * The row's counts come from `crm_broadcast_metrics()` — SQL aggregates over the
 * per-recipient ledger, not JavaScript counting over the history page. The
 * follow-up list is the failed/suppressed half of that ledger, bounded and
 * ordered by SQL with a full total, so the cap never reads as the whole list.
 *
 * `crm_email_events` remains the post-send delivery-event record. Accepted is
 * not delivered: a campaign can have provider acceptances and later bounces,
 * opens and clicks. The two sections answer different questions and are
 * deliberately not merged.
 */

const KNOWN_TYPE_ORDER = [
  'bounced',
  'complained',
  'suppressed',
  'delivery_delayed',
  'opened',
  'clicked',
];

const RENDERED_EVENT_LIMIT = 30;
const RENDERED_FOLLOW_UP_LIMIT = 20;

function orderTypes(types: string[]): string[] {
  return [...types].sort((a, b) => {
    const ai = KNOWN_TYPE_ORDER.indexOf(a);
    const bi = KNOWN_TYPE_ORDER.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });
}

function typePillClass(type: string): string {
  if (type === 'bounced' || type === 'complained' || type === 'failed')
    return 'bg-rose-100 text-rose-800';
  if (type === 'suppressed' || type === 'delivery_delayed') return 'bg-amber-100 text-amber-900';
  if (type === 'opened' || type === 'clicked') return 'bg-emerald-100 text-emerald-800';
  if (type === 'pending') return 'bg-blue-100 text-blue-800';
  return 'bg-surface-muted text-muted-foreground';
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function BroadcastDeliveryPanel({
  broadcastId,
  metrics,
}: {
  broadcastId: string;
  metrics?: BroadcastMetrics;
}) {
  const [events, setEvents] = useState<CRMBroadcastEmailEvent[] | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [failed, setFailed] = useState(false);

  const [followUps, setFollowUps] = useState<BroadcastFollowUp[] | null>(null);
  const [followUpTotal, setFollowUpTotal] = useState(0);
  const [followUpFailed, setFollowUpFailed] = useState(false);

  const ledgerAvailable = (metrics?.recordedCount ?? 0) > 0;

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setFailed(false);
    getBroadcastEmailEvents(broadcastId).then(
      (res) => {
        if (cancelled) return;
        setEvents(res.events);
        setTotalCount(res.totalCount);
      },
      () => {
        if (cancelled) return;
        setFailed(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [broadcastId]);

  useEffect(() => {
    if (!ledgerAvailable) {
      setFollowUps(null);
      setFollowUpTotal(0);
      setFollowUpFailed(false);
      return;
    }

    let cancelled = false;
    setFollowUps(null);
    setFollowUpFailed(false);
    getBroadcastFollowUps(broadcastId).then(
      (res) => {
        if (cancelled) return;
        setFollowUps(res.followUps);
        setFollowUpTotal(res.totalCount);
      },
      () => {
        if (cancelled) return;
        setFollowUpFailed(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [broadcastId, ledgerAvailable]);

  const renderedEvents = events?.slice(0, RENDERED_EVENT_LIMIT) ?? [];
  const rates = new Map<string, number>();
  for (const event of events ?? []) {
    rates.set(event.eventType, (rates.get(event.eventType) ?? 0) + 1);
  }

  return (
    <div className="space-y-3">
      {metrics && metrics.recordedCount === 0 && (
        <p className="text-[11px] font-bold text-muted-foreground">
          This campaign predates the recipient ledger. Its stored counters are shown in the history
          row; per-recipient follow-ups are not available for it.
        </p>
      )}

      {metrics && metrics.recordedCount > 0 && (
        <section className="flex items-center gap-1.5 flex-wrap" aria-label="Recipient ledger">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
            accepted · {metrics.acceptedCount}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800">
            failed · {metrics.failedCount}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900">
            suppressed · {metrics.suppressedCount}
          </span>
          {metrics.pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
              pending · {metrics.pendingCount}
            </span>
          )}
          {metrics.unresolvedCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-surface-muted text-muted-foreground">
              not recorded · {metrics.unresolvedCount}
            </span>
          )}
        </section>
      )}

      {ledgerAvailable && (
        <section aria-label="Follow-up list" className="space-y-1.5">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Needs follow-up
            {followUps !== null ? ` (${followUpTotal})` : ''}
          </h3>
          {followUpFailed ? (
            <p role="alert" className="text-[11px] font-bold text-rose-700">
              The follow-up list could not be loaded. The campaign itself is unaffected — try
              collapsing and expanding this row.
            </p>
          ) : followUps === null ? (
            <p role="status" className="text-[11px] font-bold text-muted-foreground">
              Loading follow-ups…
            </p>
          ) : followUps.length === 0 ? (
            <p className="text-[11px] font-bold text-muted-foreground">
              No failed or suppressed recipients in this campaign.
            </p>
          ) : (
            <ul className="divide-y divide-border max-w-3xl">
              {followUps.slice(0, RENDERED_FOLLOW_UP_LIMIT).map((recipient) => (
                <li
                  key={`${recipient.email}-${recipient.status}`}
                  className="py-1.5 flex items-start gap-2 text-[11px]"
                >
                  <span
                    className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${typePillClass(
                      recipient.status
                    )}`}
                  >
                    {recipient.status}
                  </span>
                  <span className="min-w-0">
                    <span className="font-bold text-foreground block truncate">
                      {recipient.recipientName || recipient.email}
                    </span>
                    {recipient.recipientName && (
                      <span className="block truncate text-muted-foreground">
                        {recipient.email}
                      </span>
                    )}
                    {recipient.reason && (
                      <span className="block text-muted-foreground">{recipient.reason}</span>
                    )}
                  </span>
                  <span className="ml-auto shrink-0 text-muted-foreground">
                    {formatTime(
                      recipient.suppressedAt ?? recipient.failedAt ?? recipient.updatedAt
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {followUps !== null &&
            followUpTotal > followUps.slice(0, RENDERED_FOLLOW_UP_LIMIT).length && (
              <p className="text-[10px] font-bold text-muted-foreground">
                Showing the {Math.min(followUps.length, RENDERED_FOLLOW_UP_LIMIT)} most recent of{' '}
                {followUpTotal} recipients needing follow-up.
              </p>
            )}
        </section>
      )}

      {failed ? (
        <p role="alert" className="text-[11px] font-bold text-rose-700">
          Delivery events could not be loaded. The campaign itself is unaffected — try collapsing
          and expanding this row.
        </p>
      ) : events === null ? (
        <p role="status" className="text-[11px] font-bold text-muted-foreground">
          Loading delivery events…
        </p>
      ) : events.length === 0 ? (
        <p className="text-[11px] font-bold text-muted-foreground">
          No delivery events yet — bounces, complaints, opens and clicks land here after sending.
        </p>
      ) : (
        <section aria-label="Delivery events" className="space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {orderTypes([...rates.keys()]).map((type) => (
              <span
                key={type}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${typePillClass(
                  type
                )}`}
              >
                {type.replace(/_/g, ' ')} · {rates.get(type)}
              </span>
            ))}
          </div>
          <ul className="divide-y divide-border max-w-3xl">
            {renderedEvents.map((event) => (
              <li key={event.id} className="py-1.5 flex items-center gap-2 text-[11px]">
                <span
                  className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${typePillClass(
                    event.eventType
                  )}`}
                >
                  {event.eventType.replace(/_/g, ' ')}
                </span>
                <span className="font-bold text-foreground truncate">
                  {event.contactEmail ?? 'Unknown recipient'}
                </span>
                <span className="ml-auto shrink-0 text-muted-foreground">
                  {formatTime(event.occurredAt)}
                </span>
              </li>
            ))}
          </ul>
          {totalCount > renderedEvents.length && (
            <p className="text-[10px] font-bold text-muted-foreground">
              Showing the {renderedEvents.length} most recent of {totalCount} events.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
