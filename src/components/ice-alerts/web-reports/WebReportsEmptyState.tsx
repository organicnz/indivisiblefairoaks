import { RotateCcw } from 'lucide-react';
import Link from 'next/link';
import type { IceSourceReportFilters } from '@/lib/ice-source-report-search';

type WebReportsEmptyStateProps = {
  filters: IceSourceReportFilters;
  filtered: boolean;
  clearQueryHref: string;
  nationwideHref: string;
};

export function WebReportsEmptyState({
  filters,
  filtered,
  clearQueryHref,
  nationwideHref,
}: WebReportsEmptyStateProps) {
  return (
    <div className="mt-8 border border-border bg-surface-card p-5 text-sm leading-relaxed text-muted-foreground">
      <p className="font-semibold text-foreground">
        {filtered ? 'No reports match these filters.' : 'No republished reports have been published yet.'}
      </p>
      <p className="mt-1">
        {filtered
          ? 'Try a broader search, a different type, or another state.'
          : 'An admin can add an approved public source and run the crawler from the admin panel.'}
      </p>
      {filtered ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.query ? (
            <Link
              href={clearQueryHref}
              className="inline-flex min-h-9 items-center gap-1.5 border border-border bg-background px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Clear search, keep area
            </Link>
          ) : null}
          {filters.city || filters.stateCode ? (
            <Link
              href={nationwideHref}
              className="inline-flex min-h-9 items-center gap-1.5 border border-border bg-background px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Search nationwide
            </Link>
          ) : null}
          <Link
            href="/ice-alerts/web-reports"
            className="inline-flex min-h-9 items-center gap-1.5 border border-border bg-background px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <RotateCcw className="size-3" aria-hidden="true" />
            Clear all filters
          </Link>
        </div>
      ) : null}
    </div>
  );
}
