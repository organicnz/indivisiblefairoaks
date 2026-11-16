import { ArrowLeft, ArrowRight, Globe2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { WebReportCard } from '@/components/ice-alerts/WebReportsSection';
import {
  getIceCrawlStore,
  getPublishedSourceReportCount,
  getPublishedSourceReports,
} from '@/lib/ice-crawl-store';
import { pageMetadata } from '@/lib/metadata';
import type { IceSourceReport } from '@/lib/ice-crawl-types';

const PER_PAGE = 20;

export const metadata: Metadata = pageMetadata({
  title: 'Web Source Reports | ICE Alert',
  description:
    'Browse source-attributed public web reports collected by the chapter, with the original URL, source label, publication time, and full readable source text.',
  path: '/ice-alerts/web-reports',
  robots: { index: false, follow: false },
});

// Deliberate Cache Components opt-out: the page number comes from searchParams
// and the archive is written by the crawler between requests.
export const instant = false;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readPage(params: Record<string, string | string[] | undefined>) {
  const raw = params.page;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

async function readArchive(page: number) {
  const store = getIceCrawlStore();
  if (!store) return { reports: [] as IceSourceReport[], total: 0 };
  try {
    const total = await getPublishedSourceReportCount(store);
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    const current = Math.min(page, totalPages);
    const reports = await getPublishedSourceReports(
      store,
      PER_PAGE,
      (current - 1) * PER_PAGE
    );
    return { reports, total, totalPages: totalPages, current };
  } catch {
    return { reports: [] as IceSourceReport[], total: 0, totalPages: 1, current: 1 };
  }
}

export default async function WebReportsPage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;
  const archive = await readArchive(readPage(params));
  const { reports, total } = archive;
  const current = archive.current ?? 1;
  const totalPages = archive.totalPages ?? 1;

  return (
    <main className="civic-page min-h-screen bg-background pb-20 pt-(--header-clearance) text-foreground">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="border-b border-foreground/20 py-10 sm:py-14">
          <Link
            href="/ice-alerts#web-reports"
            className="inline-flex min-h-9 items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="size-3" aria-hidden="true" />
            Back to ICE Alert
          </Link>
          <p className="civic-section-index mt-6">Source-attributed web reports</p>
          <h1 className="mt-2 max-w-3xl font-display text-4xl font-semibold leading-[0.95] tracking-[-0.045em] sm:text-6xl">
            Every gathered report, with its source.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Full readable passages collected from approved public sources. Every entry keeps its
            original URL, source label, publication time, and retrieval time. These reports are not
            independently verified by this chapter, and the source&apos;s own terms may apply.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 border border-border bg-surface-card px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
            <Globe2 className="size-3" aria-hidden="true" />
            {total.toLocaleString('en-US')} report{total === 1 ? '' : 's'} archived
          </p>
        </div>

        {reports.length === 0 ? (
          <p className="mt-8 border border-border bg-surface-card p-5 text-sm leading-relaxed text-muted-foreground">
            No web-source reports have been published yet. An admin can add an approved public
            source and run the crawler from the admin panel.
          </p>
        ) : (
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
                    href={`/ice-alerts/web-reports?page=${current - 1}`}
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
                    href={`/ice-alerts/web-reports?page=${current + 1}`}
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
        )}
      </div>
    </main>
  );
}
