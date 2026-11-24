import type {
  DirectEmailDelivery,
  DirectEmailDeliveryEventType,
  DirectEmailDeliveryStatus,
} from '@/types/crm';

const STATUS_LABELS: Record<DirectEmailDeliveryStatus, string> = {
  accepted: 'Accepted',
  delivered: 'Delivered',
  bounced: 'Bounced',
  complained: 'Complained',
};

const EVENT_LABELS: Record<DirectEmailDeliveryEventType, string> = {
  delivered: 'Delivered',
  bounced: 'Bounced',
  complained: 'Complained',
  suppressed: 'Suppressed by Resend',
};

const PILL_CLASSES: Record<DirectEmailDeliveryStatus, string> = {
  accepted: 'bg-blue-100 text-blue-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  bounced: 'bg-amber-100 text-amber-900',
  complained: 'bg-rose-100 text-rose-800',
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

interface StatusPill {
  status: DirectEmailDeliveryStatus;
  at: string | null;
}

/**
 * Every observed stage, not only the final one.
 *
 * A delivered message that is later complained about should still read as
 * delivered somewhere; the primary `status` follows the latest outcome, but
 * the sequence is what explains the contact's history.
 */
export function DirectEmailDeliveryStatusPills({
  delivery,
  className = '',
}: {
  delivery: DirectEmailDelivery;
  className?: string;
}) {
  const pills: StatusPill[] = [
    { status: 'accepted', at: delivery.acceptedAt },
    ...(delivery.deliveredAt ? [{ status: 'delivered' as const, at: delivery.deliveredAt }] : []),
    ...(delivery.bouncedAt ? [{ status: 'bounced' as const, at: delivery.bouncedAt }] : []),
    ...(delivery.complainedAt
      ? [{ status: 'complained' as const, at: delivery.complainedAt }]
      : []),
  ];

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {pills.map((pill) => (
        <span
          key={pill.status}
          data-status={pill.status}
          title={pill.at ? `${STATUS_LABELS[pill.status]} ${formatTime(pill.at)}` : undefined}
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${PILL_CLASSES[pill.status]}`}
        >
          {STATUS_LABELS[pill.status]}
        </span>
      ))}
    </div>
  );
}

/** Audit-detail view: current status plus the correlated provider events. */
export function DirectEmailDeliveryPanel({ delivery }: { delivery: DirectEmailDelivery }) {
  return (
    <section className="border border-border bg-surface-card">
      <h2 className="border-b border-border px-4 py-3 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        Delivery status
      </h2>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <DirectEmailDeliveryStatusPills delivery={delivery} />
          <span className="text-sm text-foreground">
            Current status: <strong>{STATUS_LABELS[delivery.status]}</strong>
          </span>
        </div>

        {delivery.acceptedAt ? (
          <p className="text-xs text-muted-foreground">
            Accepted by Resend{' '}
            <time dateTime={delivery.acceptedAt}>{formatTime(delivery.acceptedAt)}</time>
          </p>
        ) : null}

        {delivery.events.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No delivery event has arrived yet. Accepted means Resend took the message; it is not a
            delivery guarantee.
          </p>
        ) : (
          <ol className="divide-y divide-border border-y border-border">
            {delivery.events.map((event) => (
              <li
                key={`${event.eventType}-${event.occurredAt}`}
                className="flex items-center justify-between gap-3 py-2 text-xs"
              >
                <span className="font-bold text-foreground">{EVENT_LABELS[event.eventType]}</span>
                <time className="text-muted-foreground" dateTime={event.occurredAt}>
                  {formatTime(event.occurredAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
