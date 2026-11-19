'use client';

import { Loader2, Newspaper, Search, X } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';
import { cn } from '@/lib/utils';

type NewsletterEmptyStateProps = {
  variant: 'loading' | 'archive' | 'filtered';
  dataPoints?: Record<string, string>;
  onClearFilters?: () => void;
  clearLabel?: string;
  /** Admin lists use the denser operational treatment. */
  admin?: boolean;
  className?: string;
};

/**
 * One bulletin result-state surface for the public archive and the admin
 * manager. Loading, a genuinely empty archive, and a filtered zero-result view
 * are different states, so the component names them explicitly instead of
 * making every caller re-derive the same icons, copy and reset action.
 */
export function NewsletterEmptyState({
  variant,
  dataPoints = {},
  onClearFilters,
  clearLabel = 'Clear filters',
  admin = false,
  className,
}: NewsletterEmptyStateProps) {
  if (variant === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground',
          className
        )}
      >
        <Loader2 size={24} className="animate-spin text-primary" aria-hidden="true" />
        <span className="text-xs font-semibold">Loading newsletters...</span>
      </div>
    );
  }

  if (admin) {
    const filtering = variant === 'filtered';
    return (
      <div
        className={cn(
          'space-y-2 rounded-2xl border border-dashed border-border bg-surface-muted/30 p-8 py-16 text-center',
          className
        )}
      >
        {filtering ? (
          <Search
            size={28}
            className="mx-auto text-muted-foreground/60"
            aria-hidden="true"
          />
        ) : (
          <Newspaper
            size={28}
            className="mx-auto text-muted-foreground/60"
            aria-hidden="true"
          />
        )}
        <p className="text-sm font-bold text-foreground">No newsletters found</p>
        <p className="mx-auto max-w-sm text-xs text-muted-foreground">
          {filtering
            ? 'Try a broader word or choose another topic, or clear the filters to see the complete archive.'
            : 'Publish your chapter’s first action bulletin or legislative summary.'}
        </p>
        {filtering && onClearFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={13} aria-hidden="true" />
            {clearLabel}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'civic-panel col-span-full p-12 text-center text-muted-foreground dark:text-ink-muted-on-dark',
        className
      )}
    >
      {variant === 'archive' ? (
        // `news.empty.desc` is seeded with the filter/no-results copy. Using it
        // here would make the seeded CMS value override the honest archive-empty
        // message, so this branch stays local.
        <p className="text-sm">
          No chapter bulletins have been published yet. Check back soon for the next archive
          entry.
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
