'use client';

import { DataPoint } from '@/components/ui/DataPoint';

type NewsletterEmptyStateProps = {
  variant: 'archive' | 'filtered';
  dataPoints: Record<string, string>;
  onClearFilters?: () => void;
};

export function NewsletterEmptyState({
  variant,
  dataPoints,
  onClearFilters,
}: NewsletterEmptyStateProps) {
  return (
    <div className="civic-panel col-span-full p-12 text-center text-muted-foreground dark:text-ink-muted-on-dark">
      {variant === 'archive' ? (
        // `news.empty.desc` is seeded with the filter/no-results copy. Using it
        // here would make the seeded CMS value override the honest archive-empty
        // message, so this branch stays local.
        <p className="text-sm">
          No chapter bulletins have been published yet. Check back soon for the next archive entry.
        </p>
      ) : (
        <>
          <DataPoint as="p" name="news.empty.desc" initialData={dataPoints}>
            No chapter bulletins match your criteria. Try choosing “All Topics” or searching for
            another civic keyword.
          </DataPoint>
          {onClearFilters ? (
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-4 inline-flex min-h-10 items-center border border-border bg-surface-card px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-foreground transition-colors hover:border-primary hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:text-primary-on-dark"
            >
              Clear search and topics
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
