import { ArrowUpRight, Globe2, ShieldQuestion } from 'lucide-react';
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
import { iceSourceReportPlaceLabel } from '@/lib/ice-source-report-search';
import { CopyRegion } from '@/components/cms/CopyRegion';

async function readWebReports() {
  const store = getIceCrawlStore();
  if (!store) return { reports: [], total: 0 };
  try {
    const [reports, total] = await Promise.all([
      getPublishedSourceReports(store),
      getPublishedSourceReportCount(store),
    ]);
    return { reports, total };
  } catch {
    return { reports: [], total: 0 };
  }
}

function sourceDate(value: string | null) {
  if (!value) return 'date not stated';
  return value.slice(0, 16).replace('T', ' ') + ' UTC';
}

export async function WebReportsSection() {
  await connection();
  const { reports, total } = await readWebReports();

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
                <p className="civic-section-index">Republished from the web</p>
                <h2
                  id="ice-web-reports-title"
                  className="mt-2 max-w-2xl font-display text-4xl font-semibold leading-[0.95] tracking-[-0.045em] sm:text-5xl"
                >
                  Republished from the web. Kept with its source.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  These full readable passages are republished from approved public sources. Every
                  entry keeps its original URL, source label, source page title, publication time,
                  and retrieval time. They are not independently verified by this chapter, and the
                  source&apos;s own terms may apply.
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
                Browse all {total.toLocaleString('en-US')} republished reports
                <ArrowUpRight className="size-3" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>

        {reports.length === 0 ? (
          <p className="mt-6 border border-border bg-surface-card p-5 text-sm leading-relaxed text-muted-foreground">
            No web-source reports have been published yet. An admin can add an approved public
            source and run the crawler from the admin panel.
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

  return (
    <article className="border border-border bg-surface-card p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 border border-accent/35 bg-accent/5 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-accent">
          <Globe2 className="size-2.5" aria-hidden="true" />
          Republished
        </span>
        <span className="border border-border bg-background px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {iceSourceKindLabel(report.kind)}
        </span>
        <span className="font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {place}
        </span>
      </div>

      <h3 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">
        {report.title}
      </h3>
      {report.source_title && report.source_title !== report.title ? (
        <p className="mt-1 break-words font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Source page: {report.source_title}
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

      <details className="group mt-3 border border-border bg-background">
        <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          Read full source text
          <span className="text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true">
            ▾
          </span>
        </summary>
        <div className="whitespace-pre-line border-t border-border px-3 py-3 text-xs leading-relaxed text-foreground">
          {report.text_content}
        </div>
      </details>

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
          Source text / {report.extraction_method}
        </span>
      </div>
    </article>
  );
}
