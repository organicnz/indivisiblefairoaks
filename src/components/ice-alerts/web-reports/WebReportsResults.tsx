import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { WebReportCard } from '@/components/ice-alerts/WebReportsSection';
import {
  iceSourceReportArchiveHref,
  type IceSourceReportFilters,
} from '@/lib/ice-source-report-search';
import type { IceSourceReport } from '@/lib/ice-crawl-types';

type WebReportsResultsProps = {
  reports: IceSourceReport[];
  filters: IceSourceReportFilters;
  current: number;
  totalPages: number;
};

export function WebReportsResults({
  reports,
  filters,
  current,
  totalPages,
}: WebReportsResultsProps) {
  return (
    <>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {reports.map((report) => (
          <WebReportCard key={report.id} report={report} />
        ))}
      </div>

      {totalPages > 1 && (
        <nav
          aria-label="Web report pages"
          className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6"
        >
          {current > 1 ? (
            <Link
              href={iceSourceReportArchiveHref(filters, current - 1)}
              className="inline-flex min-h-10 items-center gap-1.5 border border-border bg-surface-card px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft className="size-3" aria-hidden="true" />
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
            Page {current} of {totalPages}
          </span>
          {current < totalPages ? (
            <Link
              href={iceSourceReportArchiveHref(filters, current + 1)}
              className="inline-flex min-h-10 items-center gap-1.5 border border-border bg-surface-card px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Next
              <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
