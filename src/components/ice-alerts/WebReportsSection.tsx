import { ArrowUpRight, ShieldQuestion, Sparkles } from 'lucide-react';
import { connection } from 'next/server';
import {
  getIceCrawlStore,
  getPublishedSourceReportCount,
  getPublishedSourceReports,
} from '@/lib/ice-crawl-store';
import {
  iceSourceKindLabel,
  type IceSourceReport,
} from '@/lib/ice-crawl-types';
import {
  iceSourceReportDisplayTitle,
  iceSourceReportPlaceLabel,
  iceSourceReportTitleGeneralized,
} from '@/lib/ice-source-report-search';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { WebReportRefinedSummary } from '@/components/ice-alerts/web-reports/WebReportRefinedSummary';

async function readWebReports() {
  const store = getIceCrawlStore();
  if (!store) return { reports: [], total: 0, unavailable: true };
  try {
    const [reports, total] = await Promise.all([
      getPublishedSourceReports(store),
      getPublishedSourceReportCount(store),
    ]);
    return { reports, total, unavailable: false };
  } catch {
    return { reports: [], total: 0, unavailable: true };
  }
}

function sourceDate(value: string | null) {
  if (!value) return 'date not stated';
  return value.slice(0, 16).replace('T', ' ') + ' UTC';
}

export async function WebReportsSection() {
  await connection();
  const { reports, total, unavailable } = await readWebReports();

  return (
    <section
      id="web-reports"
      aria-labelledby="ice-web-reports-title"
      className="mx-auto max-w-7xl scroll-mt-28 px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20"
    >
      <div className="border-t border-foreground/20 pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <CopyRegion id="ice-rapid-web-reports-intro">
              <div>
                <p className="civic-section-index">Source-attributed web reports</p>
                <h2
                  id="ice-web-reports-title"
                  className="mt-2 max-w-2xl font-display text-4xl font-semibold leading-[0.95] tracking-[-0.045em] sm:text-5xl"
                >
                  Source-attributed reports. Refined for reading.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  These are AI-refined digests of reports published by approved public sources. The
                  reading panel does not embed the source article; it asks a Supabase AI endpoint for
                  a grounded paraphrase, checks it for copied passages and invented figures, and
                  caches the result. Every entry keeps its original URL, source label, publication
                  time, and retrieval time. Visible headlines are generalized to the city when the
                  original contains a street-level location. Digests are not independently verified
                  by this chapter, and the source&apos;s own terms may apply. If a digest cannot be
                  generated, the panel offers the original-source link instead of copied text.
                </p>
              </div>
            </CopyRegion>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 border border-border bg-surface-card px-2.5 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              <ShieldQuestion className="size-3" aria-hidden="true" />
              Not independently verified
            </span>
            {total > 0 && (
              <a
                href="/ice-alerts/web-reports"
                className="inline-flex min-h-9 items-center gap-1.5 border border-border bg-surface-card px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Browse all {total.toLocaleString('en-US')} source-attributed reports
                <ArrowUpRight className="size-3" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>

        {unavailable ? (
          <p
            role="status"
            className="mt-6 border border-accent/40 bg-accent/10 p-5 text-sm leading-relaxed text-foreground"
          >
            The public source archive is temporarily unavailable. No substitute reports are being
            shown; the live feed, reviewed reports, and historical FOIA map remain separate.
          </p>
        ) : reports.length === 0 ? (
          <p className="mt-6 border border-border bg-surface-card p-5 text-sm leading-relaxed text-muted-foreground">
            {total > 0
              ? `No source reports are on this page, but the archive contains ${total.toLocaleString(
                  'en-US'
                )}. Open the full archive to browse them.`
              : 'No web-source reports have been published yet. An admin can add an approved public source and run the crawler from the admin panel.'}
          </p>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {reports.map((report) => (
              <WebReportCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function WebReportCard({ report }: { report: IceSourceReport }) {
  const place = iceSourceReportPlaceLabel(report.city, report.state_code);
  const displayTitle = iceSourceReportDisplayTitle(report);
  const titleGeneralized = iceSourceReportTitleGeneralized(report);
  const rawSourceTitle = report.source_title?.normalize('NFKC').replace(/\s+/g, ' ').trim() ?? '';
  const safeSourceTitle = rawSourceTitle
    ? iceSourceReportDisplayTitle({ ...report, title: rawSourceTitle })
    : '';
  const showSourceTitle = Boolean(safeSourceTitle) && safeSourceTitle !== displayTitle;

  return (
    <article className="border border-border bg-surface-card p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 border border-accent/35 bg-accent/5 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-accent">
          <Sparkles className="size-2.5" aria-hidden="true" />
          AI digest
        </span>
        <span className="border border-border bg-background px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {iceSourceKindLabel(report.kind)}
        </span>
        <span className="font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {place}
        </span>
        {titleGeneralized ? (
          <span className="border border-accent-gold/60 bg-accent-gold/15 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-foreground">
            City-level headline
          </span>
        ) : null}
      </div>

      <h3 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">
        {displayTitle}
      </h3>
      {titleGeneralized ? (
        <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">
          The original headline may contain a street-level location, so the visible headline is
          generalized. The source URL and an AI-refined summary remain available below.
        </p>
      ) : null}
      {showSourceTitle ? (
        <p className="mt-1 break-words font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Source page: {safeSourceTitle}
        </p>
      ) : null}
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        <a
          href={report.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {report.source_name}
        </a>
        <span aria-hidden="true">/</span>
        <span>Published {sourceDate(report.source_published_at)}</span>
        <span aria-hidden="true">/</span>
        <span>Retrieved {sourceDate(report.source_retrieved_at)}</span>
      </p>

      <WebReportRefinedSummary
        reportId={report.id}
        initialText={report.refined_text}
        sourceUrl={report.source_url}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <a
          href={report.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Open original source
          <ArrowUpRight className="size-3" aria-hidden="true" />
        </a>
        <span className="font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          AI summary / {report.extraction_method}
        </span>
      </div>
    </article>
  );
}
