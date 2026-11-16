import { ArrowRight, ShieldCheck } from 'lucide-react';
import { getIceReportStore, getPublishedIceReports } from '@/lib/ice-report-intake';
import {
  iceReportKindLabel,
  type IceReportPublicRow,
} from '@/lib/ice-report-shared';
import { formatRelativeTime } from './rapid-alert-utils';

async function readReviewedReports() {
  const store = getIceReportStore();
  if (!store) return [];

  try {
    return await getPublishedIceReports(store);
  } catch {
    return [];
  }
}

export async function ReviewedReportsSection() {
  const reports = await readReviewedReports();
  const now = Date.now();

  return (
    <section
      id="reviewed-reports"
      aria-labelledby="ice-reviewed-reports-title"
      className="mx-auto max-w-7xl scroll-mt-28 px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20"
    >
      <div className="border-t border-foreground/20 pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="civic-section-index">Chapter-reviewed reports</p>
            <h2
              id="ice-reviewed-reports-title"
              className="mt-2 max-w-lg font-display text-4xl font-semibold leading-[0.95] tracking-[-0.045em] sm:text-5xl"
            >
              Published only after two reviews.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              These are sanitized, city-level summaries approved by two different chapter
              reviewers. The raw report, reporter details, names, plates, and addresses are never
              published here.
            </p>
          </div>
          <a
            href="/ice-alerts/report"
            className="inline-flex min-h-11 items-center gap-1.5 border border-border bg-surface-card px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Submit a private report
            <ArrowRight className="size-3" aria-hidden="true" />
          </a>
        </div>

        {reports.length === 0 ? (
          <p className="mt-6 border border-border bg-surface-card p-5 text-sm leading-relaxed text-muted-foreground">
            No chapter-reviewed reports have been published yet. Reports stay private until two
            different reviewers approve a sanitized city-level summary.
          </p>
        ) : (
          <div className="mt-6 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => (
              <ReviewedReportCard key={report.id} report={report} now={now} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ReviewedReportCard({
  report,
  now,
}: {
  report: IceReportPublicRow;
  now: number;
}) {
  return (
    <article className="bg-surface-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 border border-primary/35 bg-primary/5 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-primary-ink dark:text-primary-on-dark">
          <ShieldCheck className="size-2.5" aria-hidden="true" />
          Two-person review
        </span>
        <span className="border border-border bg-background px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {iceReportKindLabel(report.kind)}
        </span>
        <time
          dateTime={report.observed_at}
          className="ml-auto font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
        >
          {formatRelativeTime(report.observed_at, now)}
        </time>
      </div>
      <h3 className="mt-3 font-display text-xl font-semibold leading-tight tracking-[-0.025em]">
        {report.city}, {report.state_code}
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{report.summary}</p>
      <p className="mt-3 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
        City-level only
      </p>
    </article>
  );
}
