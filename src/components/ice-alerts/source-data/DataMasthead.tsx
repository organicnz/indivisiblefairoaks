import { ArrowLeft, ArrowRight, Download } from 'lucide-react';
import Link from 'next/link';
import { CopyRegion } from '@/components/cms/CopyRegion';
import {
  DEFAULT_ICE_SOURCE_REPORT_FILTERS,
  iceSourceReportExportHref,
} from '@/lib/ice-source-report-search';

export function DataMasthead() {
  return (
        <div className="border-b border-foreground/20 py-10 sm:py-14">
          <Link
            href="/ice-alerts"
            className="inline-flex min-h-9 items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="size-3" aria-hidden="true" />
            Back to ICE Alert
          </Link>
          <CopyRegion id="ice-data-intro">
            <div>
              <p className="civic-section-index mt-6">Open data &amp; public API</p>
              <h1 className="mt-2 max-w-4xl font-display text-4xl font-semibold leading-[0.95] tracking-[-0.045em] sm:text-6xl">
                The source data, not just a feed.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Download or query the same source-attributed reports shown in the archive. Every
                record keeps its original URL, publisher label, publication time, and retrieval
                time. No API key is required for this read-only public dataset.
              </p>
            </div>
          </CopyRegion>

          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={iceSourceReportExportHref('json', DEFAULT_ICE_SOURCE_REPORT_FILTERS)}
              className="inline-flex min-h-10 items-center gap-1.5 border border-border bg-surface-card px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Download className="size-3" aria-hidden="true" />
              Download JSON
            </a>
            <a
              href={iceSourceReportExportHref('xml', DEFAULT_ICE_SOURCE_REPORT_FILTERS)}
              className="inline-flex min-h-10 items-center gap-1.5 border border-border bg-surface-card px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Download className="size-3" aria-hidden="true" />
              Download XML
            </a>
            <Link
              href="/ice-alerts/web-reports"
              className="inline-flex min-h-10 items-center gap-1.5 border border-primary bg-primary px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Search the archive
              <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          </div>
        </div>
  );
}
