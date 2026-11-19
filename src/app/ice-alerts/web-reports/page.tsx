import type { Metadata } from 'next';
import { connection } from 'next/server';
import { SourceReportLocationPicker } from '@/components/ice-alerts/SourceReportLocationPicker';
import { WebReportsEmptyState } from '@/components/ice-alerts/web-reports/WebReportsEmptyState';
import { WebReportsFilters } from '@/components/ice-alerts/web-reports/WebReportsFilters';
import { WebReportsMasthead } from '@/components/ice-alerts/web-reports/WebReportsMasthead';
import { WebReportsResults } from '@/components/ice-alerts/web-reports/WebReportsResults';
import {
  readArchive,
  readPage,
  type SearchParams,
} from '@/components/ice-alerts/web-reports/web-reports-query';
import {
  hasIceSourceReportFilters,
  iceSourceReportArchiveHref,
  parseIceSourceReportFilters,
} from '@/lib/ice-source-report-search';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Source-Attributed Web Reports | ICE Alert',
  description:
    'Browse AI-refined, source-grounded digests of reports from approved public web sources nationwide or near your location, with the original URL, source label, and publication time.',
  path: '/ice-alerts/web-reports',
  robots: { index: false, follow: false },
});

// Deliberate Cache Components opt-out: the page number, search term, and
// filters come from searchParams and the archive is written by the crawler
// between requests.
export const instant = false;

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
    <div className="civic-page min-h-screen bg-background pb-20 pt-(--header-clearance) text-foreground">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <WebReportsMasthead total={total} filtered={filtered} />

        <SourceReportLocationPicker filters={filters} total={total} />

        <WebReportsFilters filters={filters} filtered={filtered} total={total} />

        {reports.length === 0 ? (
          <WebReportsEmptyState
            filters={filters}
            filtered={filtered}
            clearQueryHref={clearQueryHref}
            nationwideHref={nationwideHref}
          />
        ) : (
          <WebReportsResults
            reports={reports}
            filters={filters}
            current={current}
            totalPages={totalPages}
          />
        )}
      </div>
    </div>
  );
}
