import { Globe2, ScanSearch } from 'lucide-react';

export function IceCrawlHeader() {
  return (
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-white dark:bg-primary-bright">
              <ScanSearch size={14} aria-hidden="true" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
              Source-attributed collection
            </span>
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] text-foreground">
            Web report crawler
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Add public sources the chapter is allowed to republish. Every fetched page and every
            discovered report keeps its exact source URL and retrieval time. The public page
            republishes the readable source text with attribution; raw HTML and crawl errors stay
            admin-only.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 self-start border border-border bg-surface-card px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground sm:self-auto">
          <Globe2 className="size-3.5" aria-hidden="true" />
          robots.txt respected
        </div>
      </div>
  );
}
