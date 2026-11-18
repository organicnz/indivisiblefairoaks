import { ExternalLink, ShieldAlert } from 'lucide-react';

export function IceReportsHeader() {
  return (
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-white dark:bg-primary-bright">
              <ShieldAlert size={14} aria-hidden="true" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
              Private moderation
            </span>
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] text-foreground">
            ICE reports
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Raw reports are private. Unique low-risk reports may automatically publish a generated
            city-level summary; similar reports are combined. Reports with safety flags or no
            verified city wait here for manual review. First review prepares a sanitized draft; a
            different admin must approve it before that draft appears publicly. Never copy names,
            plates, addresses, contact details, or exact locations into a draft.
          </p>
        </div>

        <a
          href="/ice-alerts#reviewed-reports"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 border border-border bg-surface-card px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          View public section
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </div>
  );
}
