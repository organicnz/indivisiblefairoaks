/**
 * Adapter for the Department of Justice press-release JSON API.
 *
 * `justice.gov/news/press-releases`, its article pages and its sitemap are
 * protected by an Akamai interstitial that answers the crawler with a
 * `bm-verify` challenge page (and 403 on `sitemap.xml?page=N`). The public
 * `/api/v1/press_releases.json` endpoint is not challenged and carries the
 * full release body, so it is the entry point this source uses.
 *
 * It is the whole department's feed — local U.S. Attorney offices included —
 * so extraction is filtered by the source's `relevance_terms`. That filter is
 * applied here, before anything reaches the report table or the crawl queue,
 * which is what keeps an unfiltered feed from becoming an unfiltered intake.
 *
 * The API is oldest-first by default; the source URL carries
 * `sort_by=created&sort_order=DESC`, and `justiceReleasePageUrls` expands one
 * seed into the first pages of that ordering so a tick reads more than the
 * single newest page. The crawl frontier stores the page after a drained
 * window as a cursor, so later ticks can walk older releases without widening
 * the per-tick window.
 *
 * Operational details and the cleanup runbook: `docs/ice-source-crawl.md`.
 */

const API_PATH = '/api/v1/press_releases.json';
export const JUSTICE_RELEASE_PAGE_WINDOW = 12;
const DEFAULT_PAGES = JUSTICE_RELEASE_PAGE_WINDOW;
const API_PAGE_SIZE_FALLBACK = 20;

export type JusticeReleaseItem = {
  url: string;
  title: string;
  body: string;
  teaser: string;
  date: string | null;
  image: string | null;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word-boundary phrase match. `ICE` must not match "justice" or "police". */
export function buildRelevancePattern(terms: readonly string[]): RegExp | null {
  const cleaned = [...new Set(terms.map((term) => term.trim()).filter(Boolean))];
  if (cleaned.length === 0) return null;
  return new RegExp(`\\b(?:${cleaned.map(escapeRegExp).join('|')})\\b`, 'i');
}

function parseApi(text: string): { results: unknown[] } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const results = (parsed as { results?: unknown }).results;
  if (!Array.isArray(results) || results.length === 0) return null;
  return { results };
}

function nonNegativeInteger(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
}

/**
 * Whether the API says another page exists. `metadata.resultset` carries the
 * total count, page size and zero-based page number; when a response omits
 * that metadata, a full page is the only signal that there is more to read.
 */
export function justiceReleaseHasNextPage(text: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== 'object') return false;
  const metadata = (parsed as { metadata?: unknown }).metadata;
  if (metadata && typeof metadata === 'object') {
    const resultset = (metadata as { resultset?: unknown }).resultset;
    if (resultset && typeof resultset === 'object') {
      const row = resultset as Record<string, unknown>;
      const page = nonNegativeInteger(row.page);
      const pagesize = nonNegativeInteger(row.pagesize);
      const count = nonNegativeInteger(row.count);
      if (page !== null && pagesize !== null && pagesize > 0 && count !== null) {
        return (page + 1) * pagesize < count;
      }
    }
  }
  const results = (parsed as { results?: unknown }).results;
  return Array.isArray(results) && results.length >= API_PAGE_SIZE_FALLBACK;
}

function justiceReleaseApiUrl(rawUrl: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.hostname !== 'www.justice.gov' && parsed.hostname !== 'justice.gov') return null;
  if (parsed.pathname !== API_PATH) return null;
  return parsed;
}

/**
 * The zero-based API page a URL names. The source seed has no `page`
 * parameter and therefore means page 0; every other source URL returns null.
 */
export function justiceReleasePageNumber(rawUrl: string): number | null {
  const url = justiceReleaseApiUrl(rawUrl);
  if (!url) return null;
  const raw = url.searchParams.get('page');
  if (raw === null || raw.trim() === '') return 0;
  const page = Number(raw);
  return Number.isInteger(page) && page >= 0 ? page : null;
}

function releaseItem(entry: unknown): JusticeReleaseItem | null {
  if (!entry || typeof entry !== 'object') return null;
  const row = entry as Record<string, unknown>;
  const url = typeof row.url === 'string' ? row.url : '';
  const title = typeof row.title === 'string' ? row.title : '';
  if (!/^https:\/\//.test(url) || title.trim().length === 0) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname !== 'www.justice.gov' && parsed.hostname !== 'justice.gov') return null;
  const body = typeof row.body === 'string' ? row.body : '';
  const teaser = typeof row.teaser === 'string' ? row.teaser : '';
  if (body.trim().length === 0 && teaser.trim().length === 0) return null;
  const seconds = Number(row.date);
  const date =
    Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
  const image =
    typeof row.image === 'string' && /^https:\/\//.test(row.image.trim()) ? row.image.trim() : null;
  return { url, title: title.trim(), body, teaser, date, image };
}

export function isJusticeReleaseApi(text: string): boolean {
  return parseApi(text) !== null;
}

/**
 * Releases that belong to the source's beat, in feed order. A source without
 * relevance terms admits nothing from this feed: the API is department-wide,
 * so absence of a filter is not permission to ingest everything.
 */
export function extractJusticeReleaseItems(
  text: string,
  terms: readonly string[] | null | undefined
): JusticeReleaseItem[] | null {
  const parsed = parseApi(text);
  if (!parsed) return null;
  const pattern = buildRelevancePattern(terms ?? []);
  if (!pattern) return [];
  const seen = new Set<string>();
  const items: JusticeReleaseItem[] = [];
  for (const entry of parsed.results) {
    const item = releaseItem(entry);
    if (!item || seen.has(item.url)) continue;
    // Title and teaser only. Body mentions are how a drug-conspiracy release
    // that happens to say "immigration" once gets misfiled as ICE activity;
    // the headline is the publisher's own statement of what the release is
    // about, and it is the precision/recall line this beat needs.
    if (!pattern.test(`${item.title}\n${item.teaser}`)) continue;
    seen.add(item.url);
    items.push(item);
  }
  return items;
}

/**
 * Expand the API seed into a window of pages starting at `startPage`. The
 * default is the newest 12 pages; the crawler passes the next unvisited page
 * to resume older releases without widening the per-tick window.
 */
export function justiceReleasePageUrls(
  rawUrl: string,
  pages = DEFAULT_PAGES,
  startPage = 0
): string[] {
  const base = justiceReleaseApiUrl(rawUrl);
  if (!base) return [rawUrl];
  const count = Number.isFinite(pages) ? Math.max(1, Math.floor(pages)) : DEFAULT_PAGES;
  const first = Number.isFinite(startPage) ? Math.max(0, Math.floor(startPage)) : 0;
  return Array.from({ length: count }, (_, offset) => {
    const url = new URL(base.toString());
    url.searchParams.set('page', String(first + offset));
    return url.toString();
  });
}
