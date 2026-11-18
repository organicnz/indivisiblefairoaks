import { RefreshCw, WifiOff } from 'lucide-react';
import { formatRelativeTime } from './rapid-alert-utils';

type RapidCacheBannerProps = {
  cachedAt: number | null;
  now: number;
  isRefreshing: boolean;
  onRefresh: () => void;
};

/**
 * The cached snapshot is real public data, but it is not a live check. This
 * banner is deliberately shown instead of the surge banner so an old snapshot
 * can never be presented as current surge coverage.
 */
export function RapidCacheBanner({
  cachedAt,
  now,
  isRefreshing,
  onRefresh,
}: RapidCacheBannerProps) {
  const age = cachedAt
    ? formatRelativeTime(new Date(cachedAt).toISOString(), now)
    : null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border border-accent-gold/60 bg-accent-gold/15 px-3.5 py-2.5"
    >
      <span className="inline-flex shrink-0 items-center gap-2 font-mono text-[9px] font-black uppercase tracking-[0.12em] text-foreground">
        <WifiOff className="size-3.5" aria-hidden="true" />
        Cached snapshot
      </span>
      <span className="min-w-0 flex-1 text-[10px] leading-snug text-foreground">
        Showing the last successful public feed saved on this device
        {age ? ` ${age}` : ''}. It is not a live check, and surge conditions are paused
        until the live feed reconnects.
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="inline-flex min-h-8 items-center gap-1.5 border border-border bg-background px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-60"
      >
        <RefreshCw className={`size-3 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
        {isRefreshing ? 'Retrying' : 'Retry feed'}
      </button>
    </div>
  );
}
