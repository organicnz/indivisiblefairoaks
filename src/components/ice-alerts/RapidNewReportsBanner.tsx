import { ArrowRight, Sparkles } from 'lucide-react';

type RapidNewReportsBannerProps = {
  count: number;
  onShowNew: () => void;
};

export function RapidNewReportsBanner({
  count,
  onShowNew,
}: RapidNewReportsBannerProps) {
  if (count <= 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-2 flex flex-wrap items-center gap-2 border border-accent/40 bg-accent/5 px-3.5 py-2.5"
    >
      <span className="inline-flex shrink-0 items-center gap-2 font-mono text-[9px] font-black uppercase tracking-[0.12em] text-accent">
        <Sparkles className="size-3.5" aria-hidden="true" />
        {count.toLocaleString('en-US')} new {count === 1 ? 'report' : 'reports'}
      </span>
      <span className="min-w-0 flex-1 text-[10px] leading-snug text-foreground">
        New since your last check on this browser. These are real current-feed rows, not an
        independent verification.
      </span>
      <button
        type="button"
        onClick={onShowNew}
        className="inline-flex min-h-8 items-center gap-1 border border-border bg-background px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Show newest
        <ArrowRight className="size-3" aria-hidden="true" />
      </button>
    </div>
  );
}
