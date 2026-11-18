import { inflateRawSync } from 'node:zlib';
import { decodeHtmlEntities, normalizeText } from '@/lib/ice-crawl-extract';

/** Broad U.S. news query used by the nationwide discovery pass. */
export const NATIONWIDE_DISCOVERY_QUERY =
  '("Immigration and Customs Enforcement" OR "ICE agents" OR "ICE raid" OR "ICE raids" OR "ICE arrest" OR "ICE arrests" OR "ICE detention" OR "ICE checkpoint" OR "immigration raid" OR "immigration raids" OR "immigration arrests" OR "federal immigration agents" OR "287(g)") sourcecountry:US sourcelang:english';

export const NATIONWIDE_DISCOVERY_LABEL = 'nationwide-ice';
export const NATIONWIDE_DISCOVERY_TIMESPAN = '3d';
export const NATIONWIDE_DISCOVERY_MAX_RECORDS = 500;

const GDELT_MAX_RECORDS = 250;
const GDELT_ENDPOINT = 'https://api.gdeltproject.org/api/v2/doc/doc';
const GDELT_LASTUPDATE_URL = 'https://data.gdeltproject.org/gdeltv2/lastupdate.txt';
const BING_NEWS_ENDPOINT = 'https://www.bing.com/news/search';
const DISCOVERY_USER_AGENT =
  'IndivisibleFairOaks-ReportCrawler/1.0 (+https://indivisiblefairoaks.org; nationwide source discovery)';
const FETCH_TIMEOUT_MS = 15_000;
const FEED_FETCH_TIMEOUT_MS = 12_000;
const SOCIAL_FETCH_TIMEOUT_MS = 10_000;
const GKG_FETCH_TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 6_000;
const DISCOVERY_RECENCY_MS = 3 * 24 * 60 * 60 * 1000;

/** Bing News RSS is the broad index; direct feeds keep major outlets covered. */
const BING_NEWS_QUERIES: Array<{ query: string; language?: string }> = [
  { query: 'ICE raid' },
  { query: 'ICE arrests' },
  { query: 'ICE detention' },
  { query: 'ICE checkpoint' },
  { query: 'immigration raid' },
  { query: '287(g)' },
  { query: 'redadas de ICE', language: 'es-US' },
  { query: 'arrestos de ICE', language: 'es-US' },
  { query: 'detención migratoria', language: 'es-US' },
];

/** Public RSS feeds from national and California outlets. */
const NEWS_FEEDS: Array<{ id: string; label: string; url: string }> = [
  { id: 'npr', label: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml' },
  { id: 'fox-news', label: 'Fox News', url: 'https://moxie.foxnews.com/google-publisher/us.xml' },
  { id: 'nbc-news', label: 'NBC News', url: 'https://feeds.nbcnews.com/nbcnews/public/news' },
  { id: 'abc-news', label: 'ABC News', url: 'https://abcnews.go.com/abcnews/topstories' },
  { id: 'cbs-news', label: 'CBS News', url: 'https://www.cbsnews.com/latest/rss/main' },
  { id: 'guardian-us', label: 'The Guardian US', url: 'https://www.theguardian.com/us-news/rss' },
  { id: 'latimes', label: 'Los Angeles Times', url: 'https://www.latimes.com/california/rss2.0.xml' },
  { id: 'calmatters', label: 'CalMatters', url: 'https://calmatters.org/feed/' },
  { id: 'pbs-newshour', label: 'PBS NewsHour', url: 'https://www.pbs.org/newshour/feeds/rss/politics' },
];

/** Public Mastodon tag timelines. No login or app credential is required. */
const MASTODON_INSTANCES = ['mastodon.social', 'hachyderm.io'] as const;
const MASTODON_TAGS = [
  'StopICE',
  'abolishICE',
  'immigrationdetention',
  'immigrationenforcement',
  'immigration',
] as const;
const MAX_URL_LENGTH = 2_000;
const MAX_GKG_ZIP_BYTES = 12_000_000;
const MAX_GKG_UNCOMPRESSED_BYTES = 40_000_000;
const GKG_DATE_TIME = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/;
const GKG_TITLE = /<PAGE_TITLE>([\s\S]*?)<\/PAGE_TITLE>/i;
const GKG_PRECISE_TIME = /<PAGE_PRECISEPUBTIMESTAMP>(\d{14})<\/PAGE_PRECISEPUBTIMESTAMP>/i;

const BLOCKED_HOSTS = [
  'bing.com',
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
  'gbraid',
  'wbraid',
  'dclid',
  'msclkid',
  'twclid',
  'ttclid',
  'yclid',
  'srsltid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'ref',
  'ref_src',
  'cmpid',
  'campaignid',
  'adid',
  's_kwcid',
  '_ga',
  '_gl',
  '_hsenc',
  '_hsmi',
  'mkt_tok',
  'vero_id',
  'oly_anon_id',
  'oly_enc_id',
  'ncid',
  'smid',
  'cmp',
  'ocid',
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
  /** Disable the RSS/Bing pass for focused single-source tests. */
  includeNewsFeeds?: boolean;
  /** Disable the public social pass for focused single-source tests. */
  includeSocial?: boolean;
};

export type GdeltDiscoveryProvider = 'gdelt-api' | 'gdelt-gkg';
export type IceCrawlDiscoveryProvider =
  | GdeltDiscoveryProvider
  | 'bing-news'
  | 'rss'
  | 'mastodon';

export type NationwideDiscoveryResult = {
  candidates: IceCrawlDiscoveryCandidate[];
  errors: string[];
  query: string;
  provider: IceCrawlDiscoveryProvider | 'multi-source';
  providers: IceCrawlDiscoveryProvider[];
};

export function buildGdeltDiscoveryUrl(query = NATIONWIDE_DISCOVERY_QUERY) {
  const url = new URL(GDELT_ENDPOINT);
  url.searchParams.set('query', query);
  url.searchParams.set('mode', 'ArtList');
  url.searchParams.set('format', 'json');
  url.searchParams.set('maxrecords', String(GDELT_MAX_RECORDS));
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
  const normalized = key.toLowerCase();
  return (
    normalized.startsWith('utm_') ||
    normalized.startsWith('pk_') ||
    normalized.startsWith('mtm_') ||
    normalized.startsWith('hsa_') ||
    TRACKING_PARAMS.has(normalized)
  );
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
    if (url.hostname.startsWith('www.')) url.hostname = url.hostname.slice(4);
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
    .slice(0, GDELT_MAX_RECORDS);
}

function titleKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Stable database identity for a story. URL variants and syndicated copies
 * with the same normalized headline on the same UTC day collapse to one
 * discovery row; the publication day keeps a recurring headline from blocking
 * a genuinely new later story.
 */
export function discoveryStoryKey(
  title: string,
  publisher: string | null,
  publishedAt: string | null
) {
  const day =
    publishedAt && !Number.isNaN(Date.parse(publishedAt))
      ? new Date(publishedAt).toISOString().slice(0, 10)
      : '';
  const normalizedTitle = titleKey(title);
  const normalizedPublisher = titleKey(publisher ?? '');
  const storyTitle =
    normalizedPublisher && normalizedTitle.endsWith(` ${normalizedPublisher}`)
      ? normalizedTitle.slice(0, -(normalizedPublisher.length + 1)).trim()
      : normalizedTitle;
  return `${storyTitle}|${day}`;
}

/** Remove feed HTML/entities before storing or matching a headline. */
export function stripDiscoveryMarkup(value: string) {
  const decoded = decodeHtmlEntities(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
  return normalizeText(decoded).slice(0, 1_000);
}

function cleanHeadline(value: string) {
  return stripDiscoveryMarkup(value).replace(/\s+/g, ' ').trim().slice(0, 300);
}

/**
 * Shared relevance gate for feeds and social posts. It intentionally rejects
 * the frozen-water meaning of ICE and keeps immigration-enforcement leads.
 */
export function mentionsIceEnforcement(value: string) {
  const text = stripDiscoveryMarkup(value).toLowerCase();
  if (!text) return false;
  const ice =
    /\bice\b/.test(text) || text.includes('immigration and customs enforcement');
  const enforcement =
    /\b(?:raid|raids|arrest|arrests|arrested|detain|detained|detention|deport|deported|deportation|checkpoint|checkpoints|enforcement|operation|operations|sweep|sweeps|worksite|worksites|agents?)\b/.test(
      text
    );
  const immigration =
    /\b(?:immigration|immigrant|immigrants|migrant|migrants|asylum|deportation|detention)\b/.test(
      text
    );
  const spanishEnforcement =
    /\b(?:redada|redadas|arresto|arrestos|detenci[oó]n|deportaci[oó]n|agentes de inmigraci[oó]n)\b/.test(
      text
    );
  const spanishImmigration =
    /\b(?:inmigraci[oó]n|inmigrante|inmigrantes|migrante|migrantes|migratori[ao])\b/.test(text);

  return (
    (ice && enforcement) ||
    (immigration && enforcement) ||
    /\b287\s*\(\s*g\s*\)/.test(text) ||
    (spanishImmigration && spanishEnforcement)
  );
}

type ParsedRssItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
};

function xmlText(value: string) {
  return decodeHtmlEntities(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))
    .replace(/&amp;/g, '&')
    .trim();
}

function xmlTagValue(xml: string, tag: string) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(
    new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i')
  );
  return match ? xmlText(match[1]) : '';
}

/** Parse RSS 2.0 items defensively; malformed items are ignored. */
export function parseRssItems(xml: string): ParsedRssItem[] {
  const items: ParsedRssItem[] = [];
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const body = match[1] ?? '';
    const title = xmlTagValue(body, 'title');
    const link = xmlTagValue(body, 'link') || xmlTagValue(body, 'guid');
    if (!title || !link) continue;
    items.push({
      title,
      link,
      description: xmlTagValue(body, 'description') || xmlTagValue(body, 'content:encoded'),
      pubDate: xmlTagValue(body, 'pubDate') || xmlTagValue(body, 'published'),
      source: xmlTagValue(body, 'News:Source') || xmlTagValue(body, 'source'),
    });
    if (items.length >= 100) break;
  }
  return items;
}

function parseDiscoveryDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function candidateTitleKey(candidate: IceCrawlDiscoveryCandidate) {
  let title = candidate.title;
  const publisher = candidate.publisher?.trim();
  if (publisher && publisher.length >= 3) {
    const suffix = new RegExp(
      `\\s+[-|–—]\\s+${publisher.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      'i'
    );
    title = title.replace(suffix, '');
  }
  return titleKey(title);
}

export function dedupeDiscoveryCandidates(
  candidates: IceCrawlDiscoveryCandidate[]
): IceCrawlDiscoveryCandidate[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const unique: IceCrawlDiscoveryCandidate[] = [];

  for (const candidate of candidates) {
    const url = canonicalizeDiscoveryUrl(candidate.url);
    if (!url) continue;
    const key = candidateTitleKey(candidate);
    if (seenUrls.has(url) || (key && seenTitles.has(key))) continue;
    seenUrls.add(url);
    if (key) seenTitles.add(key);
    unique.push({ ...candidate, url });
  }

  return unique.sort((left, right) =>
    (right.published_at ?? '').localeCompare(left.published_at ?? '')
  );
}

export function buildBingNewsUrl(query: string, language = 'en-US') {
  const url = new URL(BING_NEWS_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'rss');
  url.searchParams.set('cc', 'us');
  url.searchParams.set('setlang', language);
  return url.toString();
}

function bingTarget(link: string) {
  try {
    const parsed = new URL(link);
    if (/(^|\.)bing\.com$/i.test(parsed.hostname)) {
      return parsed.searchParams.get('url');
    }
    return link;
  } catch {
    return null;
  }
}

/**
 * Bing News RSS links are redirects, but the destination is carried in the
 * `url` query parameter. Resolve that before canonicalizing so an approved
 * source points at the publisher, not at Bing.
 */
export function parseBingNewsPayload(
  xml: string,
  query: string
): IceCrawlDiscoveryCandidate[] {
  const candidates: IceCrawlDiscoveryCandidate[] = [];
  for (const item of parseRssItems(xml)) {
    const target = bingTarget(item.link);
    if (!target) continue;
    const url = canonicalizeDiscoveryUrl(target);
    if (!url) continue;
    const title = cleanHeadline(item.title);
    if (!title || !mentionsIceEnforcement(`${title} ${item.description}`)) continue;
    const rawPublisher = stripDiscoveryMarkup(item.source);
    const publisher = rawPublisher || new URL(url).hostname.replace(/^www\./, '');
    candidates.push({
      url,
      title,
      publisher: publisher.slice(0, 120) || null,
      published_at: parseDiscoveryDate(item.pubDate),
      discovery_query: `bing:${query}`.slice(0, 120),
    });
  }
  return dedupeDiscoveryCandidates(candidates);
}

/** Parse one major-outlet RSS feed and keep only ICE/immigration enforcement. */
export function parseNewsFeedPayload(
  xml: string,
  feed: { id: string; label: string }
): IceCrawlDiscoveryCandidate[] {
  const candidates: IceCrawlDiscoveryCandidate[] = [];
  for (const item of parseRssItems(xml)) {
    const url = canonicalizeDiscoveryUrl(item.link);
    if (!url) continue;
    const title = cleanHeadline(item.title);
    if (!title || !mentionsIceEnforcement(`${title} ${item.description}`)) continue;
    candidates.push({
      url,
      title,
      publisher: feed.label,
      published_at: parseDiscoveryDate(item.pubDate),
      discovery_query: `rss:${feed.id}`.slice(0, 120),
    });
  }
  return dedupeDiscoveryCandidates(candidates);
}

/** Parse public Mastodon statuses returned by a tag timeline. */
export function parseMastodonPayload(
  payload: unknown,
  tag: string
): IceCrawlDiscoveryCandidate[] {
  if (!Array.isArray(payload)) return [];
  const candidates: IceCrawlDiscoveryCandidate[] = [];
  for (const raw of payload) {
    if (!raw || typeof raw !== 'object') continue;
    const wrapper = raw as {
      reblog?: unknown;
      sensitive?: unknown;
    };
    const status = (wrapper.reblog && typeof wrapper.reblog === 'object'
      ? wrapper.reblog
      : raw) as {
      url?: unknown;
      uri?: unknown;
      content?: unknown;
      created_at?: unknown;
      sensitive?: unknown;
      account?: { acct?: unknown };
    };
    if (wrapper.sensitive === true || status.sensitive === true) continue;
    const text = cleanHeadline(String(status.content ?? ''));
    if (!text || !mentionsIceEnforcement(text)) continue;
    const rawUrl =
      typeof status.url === 'string'
        ? status.url
        : typeof status.uri === 'string'
          ? status.uri
          : '';
    const url = canonicalizeDiscoveryUrl(rawUrl);
    if (!url) continue;
    const acct = typeof status.account?.acct === 'string' ? status.account.acct : '';
    candidates.push({
      url,
      title: text,
      publisher: (acct ? `@${acct}` : new URL(url).hostname).slice(0, 120),
      published_at: parseDiscoveryDate(
        typeof status.created_at === 'string' ? status.created_at : null
      ),
      discovery_query: `mastodon:${tag}`.slice(0, 120),
    });
  }
  return dedupeDiscoveryCandidates(candidates);
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

  return candidates.slice(0, GDELT_MAX_RECORDS);
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
      'User-Agent': DISCOVERY_USER_AGENT,
    });
    if (!manifest.ok) throw new Error(`GDELT manifest returned HTTP ${manifest.status}.`);
    const gkgUrl = findLatestGkgUrl(await manifest.text());
    if (!gkgUrl) throw new Error('GDELT manifest had no GKG archive.');

    const archive = await fetchWithTimeout(fetchImpl, gkgUrl, GKG_FETCH_TIMEOUT_MS, {
      Accept: 'application/zip',
      'User-Agent': DISCOVERY_USER_AGENT,
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
export async function discoverGdeltNationwideIceCandidates(
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
      providers: ['gdelt-gkg'],
    };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchWithTimeout(fetchImpl, url, FETCH_TIMEOUT_MS, {
        Accept: 'application/json',
        'User-Agent': DISCOVERY_USER_AGENT,
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
        providers: ['gdelt-api'],
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
      providers: ['gdelt-gkg'],
    };
  }

  return {
    candidates: [],
    errors: [lastError, ...fallback.errors],
    query,
    provider: 'gdelt-gkg',
    providers: ['gdelt-gkg'],
  };
}

type DiscoveryBatch = {
  candidates: IceCrawlDiscoveryCandidate[];
  errors: string[];
  providers: IceCrawlDiscoveryProvider[];
};

function emptyBatch(): DiscoveryBatch {
  return { candidates: [], errors: [], providers: [] };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function discoverFromBingNews(fetchImpl: typeof fetch): Promise<DiscoveryBatch> {
  const results = await Promise.all(
    BING_NEWS_QUERIES.map(async ({ query, language }): Promise<DiscoveryBatch> => {
      try {
        const response = await fetchWithTimeout(
          fetchImpl,
          buildBingNewsUrl(query, language),
          FEED_FETCH_TIMEOUT_MS,
          {
            Accept: 'application/rss+xml, application/xml, text/xml',
            'User-Agent': DISCOVERY_USER_AGENT,
          }
        );
        if (!response.ok) throw new Error(`Bing News returned HTTP ${response.status}.`);
        return {
          candidates: parseBingNewsPayload(await response.text(), query),
          errors: [],
          providers: ['bing-news'],
        };
      } catch (error) {
        return {
          candidates: [],
          errors: [`Bing News "${query}" failed: ${errorMessage(error, 'request failed')}`],
          providers: [],
        };
      }
    })
  );

  return {
    candidates: results.flatMap((result) => result.candidates),
    errors: results.flatMap((result) => result.errors),
    providers: [...new Set(results.flatMap((result) => result.providers))],
  };
}

async function discoverFromNewsFeeds(fetchImpl: typeof fetch): Promise<DiscoveryBatch> {
  const results = await Promise.all(
    NEWS_FEEDS.map(async (feed): Promise<DiscoveryBatch> => {
      try {
        const response = await fetchWithTimeout(fetchImpl, feed.url, FEED_FETCH_TIMEOUT_MS, {
          Accept: 'application/rss+xml, application/xml, text/xml',
          'User-Agent': DISCOVERY_USER_AGENT,
        });
        if (!response.ok) throw new Error(`${feed.label} returned HTTP ${response.status}.`);
        return {
          candidates: parseNewsFeedPayload(await response.text(), feed),
          errors: [],
          providers: ['rss'],
        };
      } catch (error) {
        return {
          candidates: [],
          errors: [`${feed.label} RSS failed: ${errorMessage(error, 'request failed')}`],
          providers: [],
        };
      }
    })
  );

  return {
    candidates: results.flatMap((result) => result.candidates),
    errors: results.flatMap((result) => result.errors),
    providers: [...new Set(results.flatMap((result) => result.providers))],
  };
}

async function discoverFromMastodon(fetchImpl: typeof fetch): Promise<DiscoveryBatch> {
  const cutoff = Date.now() - DISCOVERY_RECENCY_MS;
  const requests = MASTODON_INSTANCES.flatMap((instance) =>
    MASTODON_TAGS.map((tag) => ({ instance, tag }))
  );
  const results = await Promise.all(
    requests.map(async ({ instance, tag }): Promise<DiscoveryBatch> => {
      const url = `https://${instance}/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=40`;
      try {
        const response = await fetchWithTimeout(
          fetchImpl,
          url,
          SOCIAL_FETCH_TIMEOUT_MS,
          {
            Accept: 'application/json',
            'User-Agent': DISCOVERY_USER_AGENT,
          }
        );
        if (!response.ok) throw new Error(`Mastodon returned HTTP ${response.status}.`);
        const candidates = parseMastodonPayload(await response.json(), tag).filter(
          (candidate) =>
            !candidate.published_at || Date.parse(candidate.published_at) >= cutoff
        );
        return { candidates, errors: [], providers: ['mastodon'] };
      } catch (error) {
        return {
          candidates: [],
          errors: [
            `Mastodon ${instance} #${tag} failed: ${errorMessage(error, 'request failed')}`,
          ],
          providers: [],
        };
      }
    })
  );

  return {
    candidates: results.flatMap((result) => result.candidates),
    errors: results.flatMap((result) => result.errors),
    providers: [...new Set(results.flatMap((result) => result.providers))],
  };
}

/**
 * Run the public national discovery pass: GDELT's news index, Bing News RSS,
 * direct major-outlet RSS, and public Mastodon tag timelines. Every provider is
 * best-effort; one outage does not suppress the others. Candidates are still
 * only headlines and links until an admin approves republication rights.
 */
export async function discoverNationwideIceCandidates(
  dependencies: DiscoveryDependencies = {}
): Promise<NationwideDiscoveryResult> {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const [gdelt, news, social] = await Promise.all([
    discoverGdeltNationwideIceCandidates(dependencies),
    dependencies.includeNewsFeeds === false
      ? Promise.resolve(emptyBatch())
      : Promise.all([discoverFromBingNews(fetchImpl), discoverFromNewsFeeds(fetchImpl)]).then(
          ([bing, feeds]) => ({
            candidates: [...bing.candidates, ...feeds.candidates],
            errors: [...bing.errors, ...feeds.errors],
            providers: [...new Set([...bing.providers, ...feeds.providers])],
          })
        ),
    dependencies.includeSocial === false
      ? Promise.resolve(emptyBatch())
      : discoverFromMastodon(fetchImpl),
  ]);

  const providers = [...new Set([...gdelt.providers, ...news.providers, ...social.providers])];
  return {
    candidates: dedupeDiscoveryCandidates([
      ...gdelt.candidates,
      ...news.candidates,
      ...social.candidates,
    ]).slice(0, NATIONWIDE_DISCOVERY_MAX_RECORDS),
    errors: [...gdelt.errors, ...news.errors, ...social.errors],
    query: gdelt.query,
    provider: providers.length === 1 ? providers[0] : 'multi-source',
    providers,
  };
}
