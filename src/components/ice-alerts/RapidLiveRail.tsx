import { ArrowUpRight, Radio } from 'lucide-react';
import type { RapidAlert, RapidFeedRequestState, RapidFeedSource } from './rapid-types';
import {
  formatRelativeTime,
  isAlertActive,
  STATUS_LABELS,
} from './rapid-alert-utils';

type RapidLiveRailProps = {
  alerts: RapidAlert[];
  community: RapidFeedSource | null;
  now: number;
  status: RapidFeedRequestState;
  onSelect: (id: string) => void;
  onRefresh: () => void;
};

export function RapidLiveRail({
  alerts,
  community,
  now,
  status,
  onSelect,
  onRefresh,
}: RapidLiveRailProps) {
  const active = alerts
    .filter((alert) => isAlertActive(alert, now))
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))
    .slice(0, 8);

  return (
    <section
      aria-labelledby="ice-live-rail-title"
      className="border border-border bg-surface-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-7 items-center justify-center border border-accent/40 bg-accent/10">
            <span
              className={`absolute size-2 rounded-full bg-accent ${active.length > 0 ? 'ice-live-dot' : 'opacity-40'}`}
              aria-hidden="true"
            />
            <Radio className="size-3.5 text-accent" aria-hidden="true" />
          </span>
          <div>
            <h2
              id="ice-live-rail-title"
              className="font-display text-lg font-semibold leading-none tracking-[-0.025em]"
            >
              Recent pulsing alerts
            </h2>
            {active.length > 0 ? (
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                A pulse means the community export contains a report from the last 4 hours.
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            {active.length} active
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex min-h-8 items-center gap-1.5 border border-border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Refresh
            <ArrowUpRight className="size-3" aria-hidden="true" />
          </button>
        </div>
      </div>

      {active.length > 0 ? (
        <div className="grid gap-px bg-border sm:grid-cols-2">
          {active.map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() => onSelect(alert.id)}
              className="group flex min-w-0 flex-col items-start gap-1 bg-surface-card px-3.5 py-3 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-accent">
                  <span className="size-1.5 rounded-full bg-accent ice-live-dot" aria-hidden="true" />
                  {formatRelativeTime(alert.observedAt, now)}
                </span>
                <span className="truncate font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {STATUS_LABELS[alert.status]}
                </span>
              </span>
              <span className="block w-full truncate font-display text-base font-semibold leading-tight tracking-[-0.02em]">
                {alert.place}
              </span>
              <span className="block w-full truncate text-[10px] leading-relaxed text-muted-foreground">
                {alert.title} · {alert.kind}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-3 px-4 py-2.5">
          <span className="mt-0.5 size-2 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
            <strong className="font-semibold text-foreground">
              No active community reports in the last 4 hours.
            </strong>{' '}
            {community?.status === 'stale' && community.latestAt
              ? 'The community export is delayed. '
              : ''}
            {community?.latestAt
              ? `The latest report in the public export is ${formatRelativeTime(
                  community.latestAt,
                  now
                )}. Older reports stay visible in the feed but are not presented as active.`
              : status === 'loading'
                ? 'Connecting to the community export now.'
                : 'The community export has not returned a report yet.'}
          </p>
        </div>
      )}
    </section>
  );
}
