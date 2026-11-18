import { inflateRawSync } from 'node:zlib';
import { decodeHtmlEntities, normalizeText } from '@/lib/ice-crawl-extract';

/** Broad U.S. news query used by the nationwide discovery pass. */
export const NATIONWIDE_DISCOVERY_QUERY =
  '("Immigration and Customs Enforcement" OR "ICE agents" OR "ICE raid" OR "ICE raids" OR "ICE arrest" OR "ICE arrests" OR "ICE detention" OR "ICE checkpoint" OR "immigration raid" OR "immigration raids" OR "immigration arrests" OR "federal immigration agents" OR "287(g)") sourcecountry:US sourcelang:english';

export const NATIONWIDE_DISCOVERY_LABEL = 'nationwide-ice';
export const NATIONWIDE_DISCOVERY_TIMESPAN = '3d';
export const NATIONWIDE_DISCOVERY_MAX_RECORDS = 250;

const GDELT_ENDPOINT = 'https://api.gdeltproject.org/api/v2/doc/doc';
const GDELT_LASTUPDATE_URL = 'https://data.gdeltproject.org/gdeltv2/lastupdate.txt';
const FETCH_TIMEOUT_MS = 15_000;
const GKG_FETCH_TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 6_000;
const MAX_URL_LENGTH = 2_000;
const MAX_GKG_ZIP_BYTES = 12_000_000;
const MAX_GKG_UNCOMPRESSED_BYTES = 40_000_000;
const GKG_DATE_TIME = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/;
const GKG_TITLE = /<PAGE_TITLE>([\s\S]*?)<\/PAGE_TITLE>/i;
const GKG_PRECISE_TIME = /<PAGE_PRECISEPUBTIMESTAMP>(\d{14})<\/PAGE_PRECISEPUBTIMESTAMP>/i;

const BLOCKED_HOSTS = [
  'facebook.com',
  'instagram.com',
  'x.com',
  'twitter.com',
  'tiktok.com',
  'youtube.com',
  'youtu.be',
  'reddit.com',
  'linkedin.com',
  'pinterest.com',
  'tumblr.com',
  'threads.net',
  'bsky.app',
  'news.google.com',
  'gdeltproject.org',
  'newsbreak.com',
  'msn.com',
  'yahoo.com',
  'aol.com',
];

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'ref',
  'ref_src',
  'cmpid',
  'campaignid',
  'adid',
  's_kwcid',
]);

const SKIP_EXTENSIONS =
  /\.(?:pdf|zip|rar|7z|mp4|mov|avi|png|jpe?g|gif|webp|svg|mp3|wav)(?:$|\/)/i;

export type IceCrawlDiscoveryCandidate = {
  url: string;
  title: string;
  publisher: string | null;
  published_at: string | null;
  discovery_query: string;
};

type GDELTArticle = {
  url?: unknown;
  title?: unknown;
  domain?: unknown;
  seendate?: unknown;
  sourcecountry?: unknown;
};

type DiscoveryDependencies = {
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  query?: string;
  /** Skip the rate-limited API and read the newest GKG snapshot directly. */
  forceGkg?: boolean;
};

export type GdeltDiscoveryProvider = 'gdelt-api' | 'gdelt-gkg';

export type NationwideDiscoveryResult = {
  candidates: IceCrawlDiscoveryCandidate[];
  errors: string[];
  query: string;
  provider: GdeltDiscoveryProvider;
};

export function buildGdeltDiscoveryUrl(query = NATIONWIDE_DISCOVERY_QUERY) {
  const url = new URL(GDELT_ENDPOINT);
  url.searchParams.set('query', query);
  url.searchParams.set('mode', 'ArtList');
  url.searchParams.set('format', 'json');
  url.searchParams.set('maxrecords', String(NATIONWIDE_DISCOVERY_MAX_RECORDS));
  url.searchParams.set('timespan', NATIONWIDE_DISCOVERY_TIMESPAN);
  url.searchParams.set('sort', 'DateDesc');
  return url.toString();
}

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return BLOCKED_HOSTS.some(
    (blocked) => host === blocked || host.endsWith(`.${blocked}`)
  );
}

function isTrackingParam(key: string) {
  return key.toLowerCase().startsWith('utm_') || TRACKING_PARAMS.has(key.toLowerCase());
}

/**
 * Canonical discovery URLs strip common campaign parameters and fragments so
 * the same article discovered on consecutive runs is stored once.
 */
export function canonicalizeDiscoveryUrl(raw: string): string | null {
  if (!raw || raw.length > MAX_URL_LENGTH) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (url.port && url.port !== '443') return null;
    if (isBlockedHost(url.hostname)) return null;
    if (SKIP_EXTENSIONS.test(url.pathname)) return null;
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    for (const key of [...url.searchParams.keys()]) {
      if (isTrackingParam(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return null;
  }
}

function gdeltDate(value: unknown) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const date = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6])
    )
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function gkgIso(value: string) {
  const match = GKG_DATE_TIME.exec(value);
  if (!match) return null;
  const date = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6])
    )
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Find the newest GKG archive in GDELT's public lastupdate manifest. */
export function findLatestGkgUrl(manifest: string): string | null {
  for (const line of manifest.split(/\r?\n/)) {
    const match = line.trim().match(/ (https?:\/\S+\.gkg\.csv\.zip)$/i);
    if (match) return match[1].replace(/^http:/i, 'https:');
  }
  return null;
}

/**
 * Extract the single CSV entry from GDELT's GKG zip without adding a zip
 * dependency. The archive is a standard local file header with deflate data.
 */
export function unzipGdeltGkg(buffer: Uint8Array): string {
  const zip = Buffer.from(buffer);
  let offset = 0;

  while (offset + 30 <= zip.length) {
    if (zip.readUInt32LE(offset) !== 0x04034b50) break;
    const method = zip.readUInt16LE(offset + 8);
    const compressedSize = zip.readUInt32LE(offset + 18);
    const uncompressedSize = zip.readUInt32LE(offset + 22);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > zip.length) throw new Error('GDELT GKG archive is truncated.');

    const name = zip.toString('utf8', nameStart, nameStart + nameLength);
    if (name.endsWith('.csv')) {
      if (uncompressedSize > MAX_GKG_UNCOMPRESSED_BYTES) {
        throw new Error('GDELT GKG archive is larger than the parser limit.');
      }
      const data = zip.subarray(dataStart, dataEnd);
      const output =
        method === 0
          ? data
          : method === 8
            ? inflateRawSync(data)
            : null;
      if (!output) throw new Error('GDELT GKG archive uses an unsupported compression method.');
      if (output.length > MAX_GKG_UNCOMPRESSED_BYTES) {
        throw new Error('GDELT GKG archive is larger than the parser limit.');
      }
      return output.toString('utf8');
    }

    offset = dataEnd;
  }

  throw new Error('GDELT GKG archive had no CSV entry.');
}

/**
 * Parse the GKG snapshot used when the GDELT article API is rate-limited.
 * It is deliberately limited to U.S.-located, web-collected records whose
 * title or extracted names point to ICE or immigration enforcement.
 */
export function parseGdeltGkgPayload(raw: string): IceCrawlDiscoveryCandidate[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const candidates: IceCrawlDiscoveryCandidate[] = [];

  for (const line of raw.split(/\r?\n/)) {
    if (!line) continue;
    const columns = line.split('\t');
    if (columns.length < 27 || columns[2] !== '1') continue;

    const locations = columns[9] ?? '';
    if (!locations.includes('#US#')) continue;

    const extras = columns[26] ?? '';
    const titleMatch = GKG_TITLE.exec(extras);
    if (!titleMatch) continue;
    const title = normalizeText(decodeHtmlEntities(titleMatch[1])).slice(0, 300);
    if (!title) continue;

    const titleLower = title.toLowerCase();
    const names = [columns[13] ?? '', columns[23] ?? ''].join(' ').toLowerCase();
    const titleMentionsIce =
      /\bice\b/.test(titleLower) || titleLower.includes('immigration and customs enforcement');
    const titleMentionsEnforcement =
      /\b(?:raid|raids|arrest|arrests|detain|detained|deport|deportation|detention|checkpoint|enforcement|operation|agents|sweep|worksite)\b/.test(
        titleLower
      );
    const titleMentionsImmigration =
      /\b(?:immigration|deportation|detention)\b/.test(titleLower);
    const namesMentionIce =
      /\bice\b/.test(names) || names.includes('immigration and customs enforcement');

    if (titleMentionsIce) {
      if (!titleMentionsEnforcement && !titleMentionsImmigration) continue;
    } else if (titleMentionsImmigration && titleMentionsEnforcement) {
      // Keep a headline such as "Immigration raid ..." even when the title
      // does not name ICE directly.
    } else if (namesMentionIce && titleMentionsEnforcement) {
      // GKG recognized ICE in the article even though the headline only says
      // "federal agents arrest ...".
    } else {
      continue;
    }

    const url = canonicalizeDiscoveryUrl(columns[4] ?? '');
    if (!url) continue;
    const dedupeTitle = titleKey(title);
    if (seenUrls.has(url) || (dedupeTitle && seenTitles.has(dedupeTitle))) continue;

    const publisher = normalizeText(columns[3] ?? '').slice(0, 120);
    const publishedAt =
      gkgIso(GKG_PRECISE_TIME.exec(extras)?.[1] ?? '') ??
      gkgIso(columns[1] ?? '');

    seenUrls.add(url);
    if (dedupeTitle) seenTitles.add(dedupeTitle);
    candidates.push({
      url,
      title,
      publisher: publisher || null,
      published_at: publishedAt,
      discovery_query: NATIONWIDE_DISCOVERY_LABEL,
    });
  }

  return candidates
    .sort((left, right) => (right.published_at ?? '').localeCompare(left.published_at ?? ''))
    .slice(0, NATIONWIDE_DISCOVERY_MAX_RECORDS);
}

function titleKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse the GDELT article list defensively. Any non-JSON or partially shaped
 * response yields no candidates rather than crashing a scheduled crawl.
 */
export function parseGdeltDiscoveryPayload(
  raw: string,
  query = NATIONWIDE_DISCOVERY_QUERY
): IceCrawlDiscoveryCandidate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== 'object') return [];

  const articles = (parsed as { articles?: unknown }).articles;
  if (!Array.isArray(articles)) return [];

  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const candidates: IceCrawlDiscoveryCandidate[] = [];

  for (const value of articles) {
    if (!value || typeof value !== 'object') continue;
    const article = value as GDELTArticle;
    if (typeof article.url !== 'string') continue;
    const url = canonicalizeDiscoveryUrl(article.url);
    if (!url) continue;

    const title = normalizeText(decodeHtmlEntities(String(article.title ?? ''))).slice(0, 300);
    if (!title) continue;

    const country =
      typeof article.sourcecountry === 'string' ? article.sourcecountry.toLowerCase() : '';
    if (country && country !== 'us' && !country.includes('united states')) continue;

    const dedupeTitle = titleKey(title);
    if (seenUrls.has(url) || (dedupeTitle && seenTitles.has(dedupeTitle))) continue;
    seenUrls.add(url);
    if (dedupeTitle) seenTitles.add(dedupeTitle);

    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const publisher =
      typeof article.domain === 'string' && article.domain.trim()
        ? normalizeText(article.domain).slice(0, 120)
        : hostname.slice(0, 120);

    candidates.push({
      url,
      title,
      publisher: publisher || null,
      published_at: gdeltDate(article.seendate),
      discovery_query: NATIONWIDE_DISCOVERY_LABEL,
    });
  }

  return candidates.slice(0, NATIONWIDE_DISCOVERY_MAX_RECORDS);
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number,
  headers: Record<string, string>
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { signal: controller.signal, headers });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fallback for the rate-limited GDELT article API. The latest GKG snapshot is
 * a public 15-minute news index; this reads one archive, filters U.S.-located
 * ICE/immigration records, and never stores article body text.
 */
async function discoverFromGdeltGkg(fetchImpl: typeof fetch): Promise<{
  candidates: IceCrawlDiscoveryCandidate[];
  errors: string[];
}> {
  try {
    const manifest = await fetchWithTimeout(fetchImpl, GDELT_LASTUPDATE_URL, GKG_FETCH_TIMEOUT_MS, {
      Accept: 'text/plain',
      'User-Agent':
        'IndivisibleFairOaks-ReportCrawler/1.0 (+https://indivisiblefairoaks.org; nationwide source discovery)',
    });
    if (!manifest.ok) throw new Error(`GDELT manifest returned HTTP ${manifest.status}.`);
    const gkgUrl = findLatestGkgUrl(await manifest.text());
    if (!gkgUrl) throw new Error('GDELT manifest had no GKG archive.');

    const archive = await fetchWithTimeout(fetchImpl, gkgUrl, GKG_FETCH_TIMEOUT_MS, {
      Accept: 'application/zip',
      'User-Agent':
        'IndivisibleFairOaks-ReportCrawler/1.0 (+https://indivisiblefairoaks.org; nationwide source discovery)',
    });
    if (!archive.ok) throw new Error(`GDELT GKG returned HTTP ${archive.status}.`);
    const declaredSize = Number(archive.headers.get('content-length') ?? 0);
    if (declaredSize > MAX_GKG_ZIP_BYTES) {
      throw new Error('GDELT GKG archive is larger than the discovery limit.');
    }
    const bytes = new Uint8Array(await archive.arrayBuffer());
    if (bytes.byteLength > MAX_GKG_ZIP_BYTES) {
      throw new Error('GDELT GKG archive is larger than the discovery limit.');
    }

    return {
      candidates: parseGdeltGkgPayload(unzipGdeltGkg(bytes)),
      errors: [],
    };
  } catch (error) {
    return {
      candidates: [],
      errors: [error instanceof Error ? error.message : 'GDELT GKG discovery failed.'],
    };
  }
}

/**
 * Query GDELT's U.S. news index. GDELT asks clients to make at most one request
 * every five seconds; this pass uses one request, with one retry for the plain
 * text "please limit requests" response. If the API remains rate-limited, the
 * latest public GKG snapshot is parsed instead.
 */
export async function discoverNationwideIceCandidates(
  dependencies: DiscoveryDependencies = {}
): Promise<NationwideDiscoveryResult> {
  const query = dependencies.query ?? NATIONWIDE_DISCOVERY_QUERY;
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const sleep =
    dependencies.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const url = buildGdeltDiscoveryUrl(query);
  let lastError = 'Nationwide discovery failed.';

  if (dependencies.forceGkg) {
    const fallback = await discoverFromGdeltGkg(fetchImpl);
    return {
      candidates: fallback.candidates,
      errors: fallback.errors,
      query,
      provider: 'gdelt-gkg',
    };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchWithTimeout(fetchImpl, url, FETCH_TIMEOUT_MS, {
        Accept: 'application/json',
        'User-Agent':
          'IndivisibleFairOaks-ReportCrawler/1.0 (+https://indivisiblefairoaks.org; nationwide source discovery)',
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`GDELT returned HTTP ${response.status}.`);
      }
      return {
        candidates: parseGdeltDiscoveryPayload(body, query),
        errors: [],
        query,
        provider: 'gdelt-api',
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Nationwide discovery failed.';
      if (attempt === 0) await sleep(RETRY_DELAY_MS);
    }
  }

  const fallback = await discoverFromGdeltGkg(fetchImpl);
  if (fallback.candidates.length > 0) {
    return {
      candidates: fallback.candidates,
      errors: [`${lastError} Used the latest GDELT GKG snapshot instead.`],
      query,
      provider: 'gdelt-gkg',
    };
  }

  return {
    candidates: [],
    errors: [lastError, ...fallback.errors],
    query,
    provider: 'gdelt-gkg',
  };
}
