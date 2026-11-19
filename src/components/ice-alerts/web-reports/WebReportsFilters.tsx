import { Download, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { SourceReportStateSelect } from '@/components/ice-alerts/SourceReportStateSelect';
import {
  cleanIceSourceReportCityName,
  iceSourceReportExportHref,
  type IceSourceReportFilters,
} from '@/lib/ice-source-report-search';

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

type WebReportsFiltersProps = {
  filters: IceSourceReportFilters;
  filtered: boolean;
  total: number;
};

export function WebReportsFilters({ filters, filtered, total }: WebReportsFiltersProps) {
  return (
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
                'Search source records, titles, source labels, and cities. Results stay city-level.'
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
  );
}
