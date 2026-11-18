import {
  getIceCrawlStore,
  getPublishedSourceReportCount,
  getPublishedSourceReports,
  listIceCrawlSources,
} from '@/lib/ice-crawl-store';

export type SourceHealth = {
  label: string;
  url: string;
  last_crawled_at: string | null;
  last_status: string | null;
  last_page_count: number;
  last_report_count: number;
};

export const FIELDS = [
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

export const API_EXAMPLES = [
  '/api/ice-source-reports?per_page=20',
  '/api/ice-source-reports?q=sacramento&state=CA&kind=enforcement',
  '/api/ice-source-reports?state=CA&city=Sacramento',
  '/api/ice-source-reports/locate?lat=38.5816&lng=-121.4944',
  '/api/ice-source-reports/export?format=json',
  '/api/ice-source-reports/export?format=xml&state=CA',
];

export function formatTimestamp(value: string | null) {
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

export function statusLabel(value: string | null) {
  if (value === 'ok') return 'Current';
  if (value === 'partial') return 'Partial';
  if (value === 'blocked') return 'Blocked';
  if (value === 'error') return 'Error';
  return 'Not run yet';
}

export function statusClass(value: string | null) {
  if (value === 'ok') return 'border-primary/35 bg-primary/10 text-primary dark:text-primary-on-dark';
  if (value === 'partial') return 'border-accent-gold/60 bg-accent-gold/15 text-foreground';
  if (value === 'error' || value === 'blocked') {
    return 'border-accent/40 bg-accent/10 text-accent';
  }
  return 'border-border bg-surface-muted text-muted-foreground';
}

export async function readData() {
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
