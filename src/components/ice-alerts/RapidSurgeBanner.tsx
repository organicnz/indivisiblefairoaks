import { ArrowUpRight, Radio, ShieldAlert } from 'lucide-react';
import type { RapidFeedRequestState } from './rapid-types';
import type { RapidSurge } from '@/lib/ice-rapid-surges';

type RapidSurgeBannerProps = {
  surges: RapidSurge[];
  status: RapidFeedRequestState;
  now: number;
  onSelect: (alertId: string) => void;
};

export function RapidSurgeBanner({
  surges,
  status,
  now,
  onSelect,
}: RapidSurgeBannerProps) {
  if (status === 'loading') {
    return (
      <div
        role="status"
        className="flex items-center gap-2.5 border border-border bg-surface-card px-3.5 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground"
      >
        <Radio className="size-3.5 text-accent" aria-hidden="true" />
        Watching the community export for report clusters…
      </div>
    );
  }

  if (surges.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-border bg-surface-card px-3.5 py-2.5"
      >
        <span className="inline-flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.11em] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-muted-foreground/50" aria-hidden="true" />
          No surge conditions right now
        </span>
        <span className="text-[10px] leading-snug text-muted-foreground">
          Community export is nightly; the map checks for updates every 2 minutes.
        </span>
        <span className="ml-auto font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          }).format(now)}
        </span>
      </div>
    );
  }

  const visible = surges.slice(0, 3);
  const extra = surges.length - visible.length;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-2 border border-accent/50 bg-accent/10 px-3.5 py-2.5"
    >
      <span className="inline-flex shrink-0 items-center gap-2 font-mono text-[9px] font-black uppercase tracking-[0.12em] text-accent">
        <ShieldAlert className="size-3.5" aria-hidden="true" />
        Surge watch
      </span>
      <span className="hidden h-4 w-px bg-accent/30 sm:block" aria-hidden="true" />
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {visible.map((surge) => (
          <button
            key={surge.key}
            type="button"
            onClick={() => onSelect(surge.alertIds[0])}
            className="inline-flex min-h-8 items-center gap-1.5 border border-accent/35 bg-background/80 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.07em] text-foreground transition-colors hover:border-accent hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title={surge.label}
          >
            <span className="size-1.5 rounded-full bg-accent ice-live-dot" aria-hidden="true" />
            {surge.shortLabel}
            <span className="text-accent">{surge.count}</span>
            <ArrowUpRight className="size-3 text-muted-foreground" aria-hidden="true" />
          </button>
        ))}
        {extra > 0 ? (
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            +{extra} more
          </span>
        ) : null}
      </div>
      <span className="ml-auto hidden font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground lg:inline">
        Reports, not confirmed enforcement
      </span>
    </div>
  );
}
