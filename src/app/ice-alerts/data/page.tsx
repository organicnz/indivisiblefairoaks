import {
  ArrowLeft,
  ArrowRight,
  Database,
  Download,
  ExternalLink,
  Globe2,
  Radio,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { CopyRegion } from '@/components/cms/CopyRegion';
import {
  getIceCrawlStore,
  getPublishedSourceReportCount,
  getPublishedSourceReports,
  listIceCrawlSources,
} from '@/lib/ice-crawl-store';
import {
  iceSourceReportExportHref,
  DEFAULT_ICE_SOURCE_REPORT_FILTERS,
} from '@/lib/ice-source-report-search';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'ICE Source Data & API | ICE Alert',
  description:
    'Download the chapter’s source-attributed public ICE reports as JSON or XML, or query the read-only public API. Every record keeps its original source URL and timestamps.',
  path: '/ice-alerts/data',
  robots: { index: false, follow: false },
});

// Request-time dataset metadata: the crawler writes between requests and the
// public count must not be baked into the static shell.
export const instant = false;

type SourceHealth = {
  label: string;
  url: string;
  last_crawled_at: string | null;
  last_status: string | null;
  last_page_count: number;
  last_report_count: number;
};

const FIELDS = [
  ['id', 'Stable public row identifier.'],
  ['source_name', 'The publisher or network label shown with the report.'],
  ['source_url', 'The exact original URL for this report.'],
  ['source_title', 'The title of the source page, when available.'],
  ['source_published_at', 'The publication time stated by the source, when available.'],
  ['source_retrieved_at', 'When this chapter retrieved the source text.'],
  ['title', 'The report headline derived from the source.'],
  ['text_content', 'The readable source text. Original wording is preserved.'],
  ['city', 'City or named area, when the source states one.'],
  ['state_code', 'Two-letter U.S. state code, when available.'],
  ['kind', 'enforcement, detention, checkpoint, or other.'],
  ['extraction_method', 'feed, html, ai, or fallback.'],
  ['published_at', 'When the row entered this public archive.'],
] as const;

const API_EXAMPLES = [
  '/api/ice-source-reports?per_page=20',
  '/api/ice-source-reports?q=sacramento&state=CA&kind=enforcement',
  '/api/ice-source-reports?state=CA&city=Sacramento',
  '/api/ice-source-reports/locate?lat=38.5816&lng=-121.4944',
  '/api/ice-source-reports/export?format=json',
  '/api/ice-source-reports/export?format=xml&state=CA',
];

function formatTimestamp(value: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function statusLabel(value: string | null) {
  if (value === 'ok') return 'Current';
  if (value === 'partial') return 'Partial';
  if (value === 'blocked') return 'Blocked';
  if (value === 'error') return 'Error';
  return 'Not run yet';
}

function statusClass(value: string | null) {
  if (value === 'ok') return 'border-primary/35 bg-primary/10 text-primary dark:text-primary-on-dark';
  if (value === 'partial') return 'border-accent-gold/60 bg-accent-gold/15 text-foreground';
  if (value === 'error' || value === 'blocked') {
    return 'border-accent/40 bg-accent/10 text-accent';
  }
  return 'border-border bg-surface-muted text-muted-foreground';
}

async function readData() {
  const store = getIceCrawlStore();
  if (!store) {
    return { total: 0, latestRetrievedAt: null, sources: [] as SourceHealth[] };
  }

  try {
    const [total, latest, sources] = await Promise.all([
      getPublishedSourceReportCount(store),
      getPublishedSourceReports(store, 1),
      listIceCrawlSources(store),
    ]);

    return {
      total,
      latestRetrievedAt: latest[0]?.source_retrieved_at ?? null,
      sources: sources
        .filter((source) => source.enabled)
        .map((source) => ({
          label: source.label,
          url: source.url,
          last_crawled_at: source.last_crawled_at,
          last_status: source.last_status,
          last_page_count: source.last_page_count,
          last_report_count: source.last_report_count,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    };
  } catch {
    return { total: 0, latestRetrievedAt: null, sources: [] as SourceHealth[] };
  }
}

export default async function IceSourceDataPage() {
  await connection();
  const data = await readData();
  const totalLabel = data.total.toLocaleString('en-US');

  return (
    <main className="civic-page min-h-screen bg-background pb-20 pt-(--header-clearance) text-foreground">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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

        <dl className="grid gap-px border-x border-b border-border bg-border sm:grid-cols-3">
          <div className="bg-surface-card p-5">
            <dt className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Public reports
            </dt>
            <dd className="mt-1 font-display text-3xl font-semibold tracking-[-0.03em]">
              {totalLabel}
            </dd>
          </div>
          <div className="bg-surface-card p-5">
            <dt className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Newest retrieval
            </dt>
            <dd className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em]">
              {formatTimestamp(data.latestRetrievedAt)}
            </dd>
          </div>
          <div className="bg-surface-card p-5">
            <dt className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Approved sources
            </dt>
            <dd className="mt-1 font-display text-3xl font-semibold tracking-[-0.03em]">
              {data.sources.length.toLocaleString('en-US')}
            </dd>
          </div>
        </dl>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <section className="min-w-0 border border-border bg-surface-card p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="civic-section-index">Read-only API</p>
                <h2 className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">
                  Query JSON over HTTPS.
                </h2>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The API returns the same public projection as the archive. Use <code>q</code>,{' '}
              <code>kind</code>, <code>state</code>, and <code>city</code> to filter; <code>page</code>{' '}
              and <code>per_page</code> page through results. <code>per_page</code> is capped at 100.
              The archive&apos;s Near me control uses the <code>locate</code> endpoint, which resolves
              coordinates to the nearest city with published reports and never returns a precise
              report location.
            </p>

            <div className="mt-4 space-y-2">
              {API_EXAMPLES.map((example) => (
                <code
                  key={example}
                  className="block overflow-x-auto border border-border bg-background px-3 py-2 font-mono text-[10px] leading-relaxed text-foreground"
                >
                  GET {example}
                </code>
              ))}
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <h3 className="font-mono text-[10px] font-bold tracking-[0.1em] text-muted-foreground">
                Response shape
              </h3>
              <pre className="mt-2 overflow-x-auto border border-border bg-background p-3 font-mono text-[10px] leading-relaxed text-foreground">
{`{
  "ok": true,
  "dataset": "ice-source-reports",
  "total": 3524,
  "page": 1,
  "perPage": 20,
  "totalPages": 177,
  "filters": { "query": "", "kind": "all", "stateCode": "", "city": "" },
  "reports": [ { "id": "...", "source_url": "...", "text_content": "..." } ]
}`}
              </pre>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="border border-primary/30 bg-primary/5 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="civic-section-index">Use boundary</p>
                  <h2 className="mt-1.5 font-display text-xl font-semibold leading-tight tracking-[-0.025em]">
                    Attribution, not endorsement.
                  </h2>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                The chapter does not independently verify these reports. Source text remains the
                publisher&apos;s; its terms may apply. Do not use this dataset to identify, locate, or
                harass any person. Structured location is city-level; the full source text is
                preserved verbatim.
              </p>
            </section>

            <section className="border border-border bg-surface-muted p-5">
              <p className="civic-section-index">Removal &amp; corrections</p>
              <h2 className="mt-1.5 font-display text-xl font-semibold leading-tight tracking-[-0.025em]">
                Operate a source?
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                If you publish a source and want a report corrected or removed, contact the chapter
                with the exact source URL. Do not send personal information about anyone in a
                report.
              </p>
              <Link
                href="/contact"
                className="mt-3 inline-flex min-h-9 items-center gap-1.5 border border-border bg-background px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Contact the chapter
                <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            </section>

            <section className="border border-border bg-surface-card p-5">
              <div className="flex items-center gap-2">
                <Globe2 className="size-4 text-accent" aria-hidden="true" />
                <h2 className="font-display text-xl font-semibold leading-tight tracking-[-0.025em]">
                  National source
                </h2>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                The seeded community source is the public Stop ICE Alerts Network export. The
                national network also publishes its own monthly XML files.
              </p>
              <a
                href="https://stopice.net/?data=1"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-9 items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                National data export
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </section>
          </aside>
        </div>

        <section className="mt-8 border border-border bg-surface-card">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-5 sm:p-6">
            <div>
              <p className="civic-section-index">Source status</p>
              <h2 className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">
                What was checked, and when.
              </h2>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                A partial run means at least one page was blocked, skipped, or over the configured
                limit. It is not presented as complete.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 border border-border bg-surface-muted px-2.5 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              <RefreshCw className="size-3" aria-hidden="true" />
              Updated by the crawler
            </span>
          </div>

          {data.sources.length === 0 ? (
            <p className="p-5 text-xs leading-relaxed text-muted-foreground">
              Source status is unavailable on this deployment.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-surface-muted">
                    <th className="px-4 py-2.5 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Source
                    </th>
                    <th className="px-4 py-2.5 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Last checked
                    </th>
                    <th className="px-4 py-2.5 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-right font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Pages
                    </th>
                    <th className="px-4 py-2.5 text-right font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      New last run
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.sources.map((source) => (
                    <tr key={source.url} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground underline underline-offset-2 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {source.label}
                          <ExternalLink className="size-2.5" aria-hidden="true" />
                        </a>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatTimestamp(source.last_crawled_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex border px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] ${statusClass(source.last_status)}`}
                        >
                          {statusLabel(source.last_status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-foreground">
                        {source.last_page_count.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-foreground">
                        {source.last_report_count.toLocaleString('en-US')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-8 border border-border bg-surface-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Radio className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
            <div>
              <p className="civic-section-index">Field dictionary</p>
              <h2 className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">
                What each record contains.
              </h2>
            </div>
          </div>
          <dl className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {FIELDS.map(([field, description]) => (
              <div key={field} className="border-t border-border pt-2">
                <dt className="font-mono text-[10px] font-bold text-foreground">{field}</dt>
                <dd className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {description}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
            Public exports contain only the readable projection. Raw crawled HTML, crawler errors,
            and source-management fields stay private. Reports from private intake never enter this
            dataset.
          </p>
        </section>
      </div>
    </main>
  );
}
