import {
  ArrowLeft,
  ArrowRight,
  Database,
  Download,
  Globe2,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { SourceReportLocationPicker } from '@/components/ice-alerts/SourceReportLocationPicker';
import { SourceReportStateSelect } from '@/components/ice-alerts/SourceReportStateSelect';
import { WebReportCard } from '@/components/ice-alerts/WebReportsSection';
import {
  getIceCrawlStore,
  getPublishedSourceReportCount,
  getPublishedSourceReports,
} from '@/lib/ice-crawl-store';
import {
  cleanIceSourceReportCityName,
  hasIceSourceReportFilters,
  iceSourceReportArchiveHref,
  iceSourceReportExportHref,
  parseIceSourceReportFilters,
  type IceSourceReportFilters,
} from '@/lib/ice-source-report-search';
import { pageMetadata } from '@/lib/metadata';
import type { IceSourceReport } from '@/lib/ice-crawl-types';

const PER_PAGE = 20;

export const metadata: Metadata = pageMetadata({
  title: 'Web Source Reports | ICE Alert',
  description:
    'Browse source-attributed public web reports nationwide or near your location, with the original URL, source label, publication time, and full readable source text.',
  path: '/ice-alerts/web-reports',
  robots: { index: false, follow: false },
});

// Deliberate Cache Components opt-out: the page number, search term, and
// filters come from searchParams and the archive is written by the crawler
// between requests.
export const instant = false;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readPage(params: Record<string, string | string[] | undefined>) {
  const raw = params.page;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

async function readArchive(page: number, filters: IceSourceReportFilters) {
  const store = getIceCrawlStore();
  if (!store) return { reports: [] as IceSourceReport[], total: 0, totalPages: 1, current: 1 };
  try {
    const total = await getPublishedSourceReportCount(store, filters);
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    const current = Math.min(page, totalPages);
    const reports = await getPublishedSourceReports(
      store,
      PER_PAGE,
      (current - 1) * PER_PAGE,
      filters
    );
    return { reports, total, totalPages, current };
  } catch {
    return { reports: [] as IceSourceReport[], total: 0, totalPages: 1, current: 1 };
  }
}

function FilterSummary({ filters }: { filters: IceSourceReportFilters }) {
  const area = filters.city
    ? `${cleanIceSourceReportCityName(filters.city)}${filters.stateCode ? `, ${filters.stateCode}` : ''}`
    : filters.stateCode || null;
  const labels = [
    filters.query ? `“${filters.query}”` : null,
    filters.kind !== 'all' ? filters.kind : null,
    area,
  ].filter(Boolean);

  return labels.length > 0 ? <span>{labels.join(' · ')}</span> : null;
}

export default async function WebReportsPage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;
  const filters = parseIceSourceReportFilters(params);
  const filtered = hasIceSourceReportFilters(filters);
  const archive = await readArchive(readPage(params), filters);
  const { reports, total } = archive;
  const current = archive.current ?? 1;
  const totalPages = archive.totalPages ?? 1;
  const clearQueryHref = iceSourceReportArchiveHref({ ...filters, query: '' });
  const nationwideHref = iceSourceReportArchiveHref({
    ...filters,
    city: '',
    stateCode: '',
  });

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
            original URL, source label, publication time, and retrieval time. Browse the full
            national archive, or narrow it to the nearest city with collected reports. These
            reports are not independently verified by this chapter, and the source&apos;s own terms
            may apply.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <p className="inline-flex items-center gap-2 border border-border bg-surface-card px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              <Globe2 className="size-3" aria-hidden="true" />
              {total.toLocaleString('en-US')} {filtered ? 'matching' : 'archived'} report
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

        <SourceReportLocationPicker filters={filters} total={total} />

        <form
          action="/ice-alerts/web-reports"
          method="get"
          role="search"
          className="mt-6 border border-border bg-surface-card p-4 sm:p-5"
        >
          <input type="hidden" name="city" value={filters.city} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              <SlidersHorizontal className="size-3.5 text-accent" aria-hidden="true" />
              Search the archive
            </p>
            {filtered ? (
              <Link
                href="/ice-alerts/web-reports"
                className="inline-flex min-h-8 items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                Clear filters
              </Link>
            ) : null}
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_9rem_auto] md:items-end">
            <div className="min-w-0">
              <label
                htmlFor="web-reports-query"
                className="block font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground"
              >
                Words in the report or source
              </label>
              <input
                id="web-reports-query"
                name="q"
                type="search"
                maxLength={80}
                defaultValue={filters.query}
                placeholder="City, agency, or phrase"
                className="mt-1 min-h-11 w-full border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            <div>
              <label
                htmlFor="web-reports-kind"
                className="block font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground"
              >
                Report type
              </label>
              <select
                id="web-reports-kind"
                name="kind"
                defaultValue={filters.kind}
                className="mt-1 min-h-11 w-full border border-border bg-background px-2.5 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="all">All types</option>
                <option value="enforcement">Enforcement</option>
                <option value="detention">Detention</option>
                <option value="checkpoint">Checkpoint</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="web-reports-state"
                className="block font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground"
              >
                State
              </label>
              <SourceReportStateSelect defaultValue={filters.stateCode} />
            </div>

            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-primary bg-primary px-4 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Search className="size-3.5" aria-hidden="true" />
              Search
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              {filtered ? (
                <>
                  Showing {total.toLocaleString('en-US')} matching report
                  {total === 1 ? '' : 's'} for <FilterSummary filters={filters} />.
                </>
              ) : (
                'Search full source text, titles, source labels, and cities. Results stay city-level.'
              )}
            </p>
            {total > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  <Download className="size-3" aria-hidden="true" />
                  Download filtered data
                </span>
                <a
                  href={iceSourceReportExportHref('json', filters)}
                  className="inline-flex min-h-8 items-center border border-border bg-background px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  JSON
                </a>
                <a
                  href={iceSourceReportExportHref('xml', filters)}
                  className="inline-flex min-h-8 items-center border border-border bg-background px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  XML
                </a>
              </div>
            ) : null}
          </div>
        </form>

        {reports.length === 0 ? (
          <div className="mt-8 border border-border bg-surface-card p-5 text-sm leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">
              {filtered ? 'No reports match these filters.' : 'No web-source reports have been published yet.'}
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
        )}
      </div>
    </main>
  );
}
