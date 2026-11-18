import { ArrowLeft, Database, Globe2 } from 'lucide-react';
import Link from 'next/link';
import { CopyRegion } from '@/components/cms/CopyRegion';

type WebReportsMastheadProps = {
  total: number;
  filtered: boolean;
};

export function WebReportsMasthead({ total, filtered }: WebReportsMastheadProps) {
  return (
        <div className="border-b border-foreground/20 py-10 sm:py-14">
          <Link
            href="/ice-alerts#web-reports"
            className="inline-flex min-h-9 items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="size-3" aria-hidden="true" />
            Back to ICE Alert
          </Link>
          <CopyRegion id="ice-web-reports-intro">
            <div>
              <p className="civic-section-index mt-6">Republished from the web</p>
              <h1 className="mt-2 max-w-3xl font-display text-4xl font-semibold leading-[0.95] tracking-[-0.045em] sm:text-6xl">
                Every republished report, with its source.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Full readable passages republished from approved public sources. Every entry keeps
                its original URL, source label, publication time, and retrieval time. Visible
                headlines are generalized to the city when the original contains a street-level
                location. Browse the full national archive, or narrow it to the nearest city with
                collected reports. These reports are not independently verified by this chapter,
                and the source&apos;s own terms may apply.
              </p>
            </div>
          </CopyRegion>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <p className="inline-flex items-center gap-2 border border-border bg-surface-card px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              <Globe2 className="size-3" aria-hidden="true" />
              {total.toLocaleString('en-US')} {filtered ? 'matching' : 'republished'} report
              {total === 1 ? '' : 's'}
            </p>
            <Link
              href="/ice-alerts/data"
              className="inline-flex min-h-9 items-center gap-1.5 border border-border bg-surface-card px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Database className="size-3" aria-hidden="true" />
              Open data &amp; API
            </Link>
          </div>
        </div>
  );
}
