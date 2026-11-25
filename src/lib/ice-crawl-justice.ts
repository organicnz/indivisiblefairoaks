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
 * single newest page.
 */

const API_PATH = '/api/v1/press_releases.json';
const DEFAULT_PAGES = 12;

export type JusticeReleaseItem = {
  url: string;
  title: string;
  body: string;
  teaser: string;
  date: string | null;
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
  return { url, title: title.trim(), body, teaser, date };
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
 * Expand the API seed into its newest pages. The API returns 20 releases per
 * page and the source's stored URL already carries the descending sort, so
 * this is a bounded newest-first window rather than a walk of all 13k pages.
 */
export function justiceReleasePageUrls(rawUrl: string, pages = DEFAULT_PAGES): string[] {
  let base: URL;
  try {
    base = new URL(rawUrl);
  } catch {
    return [rawUrl];
  }
  if (base.hostname !== 'www.justice.gov' && base.hostname !== 'justice.gov') {
    return [rawUrl];
  }
  if (base.pathname !== API_PATH) return [rawUrl];
  const count = Math.max(1, Math.floor(pages));
  return Array.from({ length: count }, (_, page) => {
    const url = new URL(base.toString());
    url.searchParams.set('page', String(page));
    return url.toString();
  });
}
