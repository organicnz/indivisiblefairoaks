'use client';

import { useEffect, useState } from 'react';
import { type CRMBroadcastEmailEvent, getBroadcastEmailEvents } from '@/lib/actions/crm';

/**
 * Delivery events for one campaign, inside its expanded history row.
 *
 * The row's `sent_count` counts provider *acceptances*, not deliveries — a
 * campaign with forty permanent bounces looked exactly as healthy as one with
 * none, because `crm_email_events` was written by the webhook and read by
 * nothing. This panel is the read half. It fetches on mount, and it only
 * mounts when the row expands, so a long history costs one query per opened
 * row rather than one per row on screen.
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
  if (type === 'bounced' || type === 'complained') return 'bg-rose-100 text-rose-800';
  if (type === 'suppressed' || type === 'delivery_delayed') return 'bg-amber-100 text-amber-900';
  if (type === 'opened' || type === 'clicked') return 'bg-emerald-100 text-emerald-800';
  return 'bg-slate-100 text-slate-600';
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

export function BroadcastDeliveryPanel({ broadcastId }: { broadcastId: string }) {
  const [events, setEvents] = useState<CRMBroadcastEmailEvent[] | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [failed, setFailed] = useState(false);

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

  if (failed) {
    return (
      <p role="alert" className="text-[11px] font-bold text-rose-700">
        Delivery events could not be loaded. The campaign itself is unaffected — try collapsing and
        expanding this row.
      </p>
    );
  }

  if (events === null) {
    return (
      <p role="status" className="text-[11px] font-bold text-slate-400">
        Loading delivery events…
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <p className="text-[11px] font-bold text-slate-400">
        No delivery events yet — bounces, complaints, opens and clicks land here after sending.
      </p>
    );
  }

  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.eventType, (counts.get(event.eventType) ?? 0) + 1);
  const rendered = events.slice(0, RENDERED_EVENT_LIMIT);

  return (
    <section aria-label="Delivery events" className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        {orderTypes([...counts.keys()]).map((type) => (
          <span
            key={type}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${typePillClass(type)}`}
          >
            {type.replace(/_/g, ' ')} · {counts.get(type)}
          </span>
        ))}
      </div>
      <ul className="divide-y divide-slate-100 max-w-3xl">
        {rendered.map((event) => (
          <li key={event.id} className="py-1.5 flex items-center gap-2 text-[11px]">
            <span
              className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${typePillClass(event.eventType)}`}
            >
              {event.eventType.replace(/_/g, ' ')}
            </span>
            <span className="font-bold text-secondary truncate">
              {event.contactEmail ?? 'Unknown recipient'}
            </span>
            <span className="ml-auto shrink-0 text-slate-400">{formatTime(event.occurredAt)}</span>
          </li>
        ))}
      </ul>
      {totalCount > rendered.length && (
        <p className="text-[10px] font-bold text-slate-400">
          Showing the {rendered.length} most recent of {totalCount} events.
        </p>
      )}
    </section>
  );
}
