/**
 * Pure logic for the `ice-scan` edge function.
 *
 * This module deliberately has no Deno, network or Supabase dependency so the
 * same rules can be exercised by the repository's Vitest suite. The edge
 * function wraps it with the I/O, database and provider calls.
 *
 * The scan has one job: turn the open web into *candidate* ICE case reports,
 * then admit only pages that an independent AI screen confirms are a specific
 * enforcement, detention or checkpoint account. Candidates and reports remain
 * in Supabase; this module never stores publisher text in a second place.
 */

export const DISCOVERY_LABEL = 'nationwide-ice';
export const DISCOVERY_MAX_RECORDS = 500;
export const GDELT_MAX_RECORDS = 250;
export const GDELT_ENDPOINT = 'https://api.gdeltproject.org/api/v2/doc/doc';
export const BING_NEWS_ENDPOINT = 'https://www.bing.com/news/search';

export const NATIONWIDE_DISCOVERY_QUERY =
  '("Immigration and Customs Enforcement" OR "ICE agents" OR "ICE raid" OR "ICE raids" OR "ICE arrest" OR "ICE arrests" OR "ICE detention" OR "ICE checkpoint" OR "immigration raid" OR "immigration raids" OR "immigration arrests" OR "federal immigration agents" OR "287(g)") sourcecountry:US sourcelang:english';

/**
 * A national query catches the wire-service story; these regional queries
 * catch the local outlet that actually names the city, county and operation.
 * One region rotates per tick, so the whole country is covered over a few
 * hours without spending the GDELT rate budget on every region every run.
 */
export const REGIONAL_DISCOVERY_QUERIES = [
  '("ICE" OR "immigration raid" OR "immigration arrests" OR "287(g)") sourcecountry:US sourcelang:english (California OR "Los Angeles" OR "San Francisco" OR Sacramento OR Fresno OR "San Diego")',
  '("ICE" OR "immigration raid" OR "immigration arrests" OR "287(g)") sourcecountry:US sourcelang:english (Texas OR Houston OR Dallas OR Austin OR "San Antonio" OR "El Paso")',
  '("ICE" OR "immigration raid" OR "immigration arrests" OR "287(g)") sourcecountry:US sourcelang:english (Florida OR Miami OR Orlando OR Tampa OR Jacksonville)',
  '("ICE" OR "immigration raid" OR "immigration arrests" OR "287(g)") sourcecountry:US sourcelang:english ("New York" OR "New Jersey" OR Brooklyn OR Queens OR Manhattan)',
  '("ICE" OR "immigration raid" OR "immigration arrests" OR "287(g)") sourcecountry:US sourcelang:english (Arizona OR Phoenix OR Tucson OR "Border Patrol")',
  '("ICE" OR "immigration raid" OR "immigration arrests" OR "287(g)") sourcecountry:US sourcelang:english (Georgia OR Illinois OR Chicago OR Atlanta OR "North Carolina")',
  '("ICE" OR "immigration raid" OR "immigration arrests" OR "287(g)") sourcecountry:US sourcelang:english (Washington OR Oregon OR Seattle OR Portland OR Denver OR Colorado)',
  '("ICE" OR "immigration raid" OR "immigration arrests" OR "287(g)") sourcecountry:US sourcelang:english (Ohio OR Michigan OR Pennsylvania OR Massachusetts OR Virginia OR Maryland)',
] as const;

export type DiscoveryCandidate = {
  url: string;
  title: string;
  publisher: string | null;
  published_at: string | null;
  discovery_query: string;
};

type GdeltArticle = {
  url?: unknown;
  title?: unknown;
  domain?: unknown;
  seendate?: unknown;
  sourcecountry?: unknown;
};

const MAX_URL_LENGTH = 2_000;
const MAX_TITLE = 300;
const MAX_PUBLISHER = 120;
const RECENT_MS = 5 * 24 * 60 * 60 * 1_000;

/**
 * Private and special-use address classification lives here, not in the HTTP
 * module, so the Next.js test process can exercise it without pulling Deno
 * globals into the app typecheck.
 */
function isPrivateIpv4(value: string) {
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  // Documentation ranges are not routable production targets. Treating them
  // as private keeps a test fixture from becoming an SSRF foothold.
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  if (a >= 224) return true;
  return false;
}

function mappedIpv4(value: string) {
  const match = /(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value);
  return match?.[1] ?? null;
}

export function isPrivateAddress(value: string) {
  const address = value
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .split('%')[0]
    .trim();
  if (!address) return true;
  if (!address.includes(':')) return isPrivateIpv4(address);

  if (
    address === '::' ||
    address === '::1' ||
    address === '0:0:0:0:0:0:0:1' ||
    address === '0:0:0:0:0:0:0:0'
  ) {
    return true;
  }
  // IPv4-mapped IPv6 can encode loopback in dotted or hex form
  // (`::ffff:127.0.0.1` or `::ffff:7f00:1`); 6to4 and Teredo also embed an
  // IPv4 destination. Reject the whole families rather than trying to decode
  // every representation.
  if (
    address.startsWith('::ffff:') ||
    address.startsWith('2002:') ||
    address.startsWith('2001:0:')
  ) {
    return true;
  }
  if (
    address.startsWith('fe8') ||
    address.startsWith('fe9') ||
    address.startsWith('fea') ||
    address.startsWith('feb') ||
    address.startsWith('fc') ||
    address.startsWith('fd') ||
    address.startsWith('ff') ||
    address.startsWith('2001:db8') ||
    address.startsWith('64:ff9b')
  ) {
    return true;
  }
  const mapped = mappedIpv4(address);
  if (mapped) return isPrivateIpv4(mapped);
  return false;
}

export function isIpLiteral(host: string) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(':');
}

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

const META_IMAGE_KEYS = new Set([
  'og:image',
  'og:image:url',
  'og:image:secure_url',
  'twitter:image',
  'twitter:image:src',
]);

const BLOCK_END = /<\/(?:p|div|li|h[1-6]|blockquote|article|section|tr|td|th)>|<br\s*\/?>/gi;
const DROP_ELEMENTS =
  /<(script|style|noscript|template|svg|canvas|iframe|object|embed)[\s\S]*?<\/\1>/gi;

const ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '…',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  rdquo: '”',
  rsquo: '’',
};

/** Decode the entities news feeds and CMS templates actually emit. */
export function decodeEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : ''
    })
    .replace(/&#(\d+);/g, (_, decimal: string) => {
      const code = Number(decimal);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : ''
    })
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match);
}

export function normalizeText(value: string) {
  return value
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function stripMarkup(value: string) {
  const decoded = decodeEntities(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
  return normalizeText(decoded).slice(0, 10_000);
}

export function readableText(html: string) {
  const withBreaks = html.replace(DROP_ELEMENTS, ' ').replace(BLOCK_END, '\n');
  return normalizeText(decodeEntities(withBreaks.replace(/<[^>]*>/g, ' ')));
}

function attribute(tag: string, name: string) {
  return tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? null;
}

export function extractMeta(html: string, key: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = attribute(tag, 'property') ?? attribute(tag, 'name');
    if (name?.toLowerCase() !== key.toLowerCase()) continue;
    const content = attribute(tag, 'content');
    if (content) return decodeEntities(content).trim();
  }
  return null;
}

export function extractTitle(html: string) {
  const title =
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
    extractMeta(html, 'og:title') ??
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ??
    '';
  return readableText(title).slice(0, 240);
}

export function extractPublishedAt(html: string) {
  const candidates = [
    extractMeta(html, 'article:published_time'),
    extractMeta(html, 'datePublished'),
    extractMeta(html, 'og:published_time'),
    html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1] ?? null,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

export function extractMetaDescription(html: string) {
  return (
    extractMeta(html, 'og:description') ??
    extractMeta(html, 'twitter:description') ??
    extractMeta(html, 'description')
  );
}

/** The publisher's declared preview image(s), in declaration order. */
export function extractEvidenceImageUrls(html: string, baseUrl: string, limit = 1) {
  const found: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    if (found.length >= limit) return;
    let url: URL;
    try {
      url = new URL(decodeEntities(value).trim(), baseUrl);
    } catch {
      return;
    }
    // The evidence table requires https provenance and the private bucket
    // should not receive bytes fetched over a downgradeable transport.
    if (url.protocol !== 'https:') return;
    const href = url.toString();
    if (seen.has(href)) return;
    seen.add(href);
    found.push(href);
  };

  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (found.length >= limit) break;
    const key = (attribute(tag, 'property') ?? attribute(tag, 'name') ?? '').toLowerCase();
    if (!META_IMAGE_KEYS.has(key)) continue;
    const content = attribute(tag, 'content');
    if (content) add(content);
  }

  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    if (found.length >= limit) break;
    try {
      const parsed: unknown = JSON.parse(decodeEntities(match[1]).trim());
      const values = Array.isArray(parsed) ? parsed : [parsed];
      for (const value of values) {
        if (!value || typeof value !== 'object') continue;
        const image = (value as Record<string, unknown>).image;
        const candidates = Array.isArray(image) ? image : [image];
        for (const candidate of candidates) {
          if (typeof candidate === 'string') add(candidate);
          else if (candidate && typeof candidate === 'object') {
            const url = (candidate as Record<string, unknown>).url;
            if (typeof url === 'string') add(url);
          }
        }
      }
    } catch {
      // A malformed JSON-LD block is not an image source.
    }
  }

  if (found.length < limit) {
    for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
      const src = attribute(tag, 'src');
      if (!src) continue;
      if (/^data:|logo|icon|sprite|avatar|pixel|tracking|badge/i.test(src)) continue;
      const width = Number(attribute(tag, 'width') ?? '');
      const height = Number(attribute(tag, 'height') ?? '');
      if (
        (Number.isFinite(width) && width > 0 && width < 200) ||
        (Number.isFinite(height) && height > 0 && height < 200)
      ) {
        continue;
      }
      add(src);
      if (found.length >= limit) break;
    }
  }

  return found;
}

export function canonicalizeDiscoveryUrl(raw: string): string | null {
  if (!raw || raw.length > MAX_URL_LENGTH) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (url.port && url.port !== '443') return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) {
      return null;
    }
    if (SKIP_EXTENSIONS.test(url.pathname)) return null;
    url.hash = '';
    url.hostname = host.startsWith('www.') ? host.slice(4) : host;
    for (const key of Array.from(url.searchParams.keys())) {
      const normalized = key.toLowerCase();
      if (
        normalized.startsWith('utm_') ||
        normalized.startsWith('pk_') ||
        normalized.startsWith('mtm_') ||
        normalized.startsWith('hsa_') ||
        TRACKING_PARAMS.has(normalized)
      ) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return null;
  }
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
  publishedAt: string | null,
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

function candidateTitleKey(candidate: DiscoveryCandidate) {
  let title = candidate.title;
  const publisher = candidate.publisher?.trim();
  if (publisher && publisher.length >= 3) {
    const suffix = new RegExp(
      `\\s+[-|–—]\\s+${publisher.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      'i',
    );
    title = title.replace(suffix, '');
  }
  return titleKey(title);
}

export function dedupeCandidates(candidates: readonly DiscoveryCandidate[]) {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const unique: DiscoveryCandidate[] = [];

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
    (right.published_at ?? '').localeCompare(left.published_at ?? ''),
  );
}

/**
 * Shared relevance gate for feeds and social posts. It intentionally rejects
 * the frozen-water meaning of ICE and keeps immigration-enforcement leads.
 */
export function mentionsIceEnforcement(value: string) {
  // Do not use `stripMarkup` here: its 10k cap is right for a headline but
  // wrong for a long article whose enforcement terms start below the fold.
  const text = normalizeText(decodeEntities(value).replace(/<[^>]*>/g, ' ')).toLowerCase();
  if (!text) return false;
  const ice = /\bice\b/.test(text) || text.includes('immigration and customs enforcement');
  const enforcement =
    /\b(?:raid|raids|arrest|arrests|arrested|detain|detained|detention|deport|deported|deportation|checkpoint|checkpoints|enforcement|operation|operations|sweep|sweeps|worksite|worksites|agents?)\b/.test(
      text,
    );
  const immigration =
    /\b(?:immigration|immigrant|immigrants|migrant|migrants|asylum|deportation|detention)\b/.test(
      text,
    );
  const spanishEnforcement =
    /\b(?:redada|redadas|arresto|arrestos|detenci[oó]n|deportaci[oó]n|agentes de inmigraci[oó]n)\b/.test(
      text,
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

/** A specific account, not merely an agency or navigation page. */
export function isIceReportText(text: string) {
  return (
    /\b(?:ice|immigration and customs enforcement|immigration enforcement|ice agents?)\b/i.test(
      text,
    ) &&
    /\b(?:report(?:ed|s|ing)?|sighting|seen|spotted|activity|raid|checkpoint|arrest(?:ed|s|ing)?|detain(?:ed|s|ing)?|detainer|deport(?:s|ed|ation|ing)?|apprehend(?:ed|s|ing)?|seiz(?:e|ed|es|ing)|encounter(?:ed|s)?|agents?|vehicles?|operation|sweep|worksite)\b/i.test(
      text,
    )
  );
}

export function discoveryRelevance(title: string, text: string) {
  const haystack = `${title}\n${text}`;
  return mentionsIceEnforcement(haystack) && isIceReportText(haystack);
}

export function classifyReportKind(text: string) {
  if (/\b(checkpoint|roadblock|sobriety|dui)\b/i.test(text)) return 'checkpoint';
  if (/\b(detention|detain|jail|prison|holding facility|processing center)\b/i.test(text)) {
    return 'detention';
  }
  if (
    /\b(?:ice|immigration enforcement|agents?|raid|arrest(?:ed|s|ing)?|detain(?:ed|s|ing)?|sighting|operation|sweep|worksite|deport(?:s|ed|ation|ing)?|detainer|apprehend(?:ed|s|ing)?|seiz(?:e|ed|es|ing)|encounter(?:ed|s)?)\b/i.test(
      text,
    )
  ) {
    return 'enforcement';
  }
  return 'other';
}

export function buildGdeltDiscoveryUrl(query: string) {
  const url = new URL(GDELT_ENDPOINT);
  url.searchParams.set('query', query);
  url.searchParams.set('mode', 'ArtList');
  url.searchParams.set('format', 'json');
  url.searchParams.set('maxrecords', String(GDELT_MAX_RECORDS));
  url.searchParams.set('timespan', '3d');
  url.searchParams.set('sort', 'DateDesc');
  return url.toString();
}

export function buildBingNewsUrl(query: string, language = 'en-US') {
  const url = new URL(BING_NEWS_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'rss');
  url.searchParams.set('cc', 'us');
  url.searchParams.set('setlang', language);
  return url.toString();
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
      Number(match[6]),
    ),
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseGdeltArticles(raw: string, query = DISCOVERY_LABEL) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== 'object') return [];
  const articles = (parsed as { articles?: unknown }).articles;
  if (!Array.isArray(articles)) return [];

  const candidates: DiscoveryCandidate[] = [];
  for (const value of articles) {
    if (!value || typeof value !== 'object') continue;
    const article = value as GdeltArticle;
    if (typeof article.url !== 'string') continue;
    const url = canonicalizeDiscoveryUrl(article.url);
    if (!url) continue;
    const title = normalizeText(decodeEntities(String(article.title ?? ''))).slice(0, MAX_TITLE);
    if (!title) continue;

    const country =
      typeof article.sourcecountry === 'string' ? article.sourcecountry.toLowerCase() : '';
    if (country && country !== 'us' && !country.includes('united states')) continue;

    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const publisher =
      typeof article.domain === 'string' && article.domain.trim()
        ? normalizeText(article.domain).slice(0, MAX_PUBLISHER)
        : hostname.slice(0, MAX_PUBLISHER);

    candidates.push({
      url,
      title,
      publisher: publisher || null,
      published_at: gdeltDate(article.seendate),
      discovery_query: query.slice(0, 200),
    });
  }

  return dedupeCandidates(candidates).slice(0, DISCOVERY_MAX_RECORDS);
}

type ParsedRssItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
};

function xmlText(value: string) {
  return decodeEntities(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim();
}

function xmlTagValue(xml: string, tag: string) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(
    new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'),
  );
  return match ? xmlText(match[1]) : '';
}

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

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

export function parseBingNewsPayload(xml: string, query: string) {
  const candidates: DiscoveryCandidate[] = [];
  for (const item of parseRssItems(xml)) {
    const target = bingTarget(item.link);
    if (!target) continue;
    const url = canonicalizeDiscoveryUrl(target);
    if (!url) continue;
    const title = stripMarkup(item.title).slice(0, MAX_TITLE);
    if (!title || !mentionsIceEnforcement(`${title} ${item.description}`)) continue;
    const rawPublisher = stripMarkup(item.source);
    const publisher = rawPublisher || new URL(url).hostname.replace(/^www\./, '');
    candidates.push({
      url,
      title,
      publisher: publisher.slice(0, MAX_PUBLISHER) || null,
      published_at: parseDate(item.pubDate),
      discovery_query: `bing:${query}`.slice(0, 120),
    });
  }
  return dedupeCandidates(candidates);
}

export function parseNewsFeedPayload(xml: string, feed: { id: string; label: string }) {
  const candidates: DiscoveryCandidate[] = [];
  for (const item of parseRssItems(xml)) {
    const url = canonicalizeDiscoveryUrl(item.link);
    if (!url) continue;
    const title = stripMarkup(item.title).slice(0, MAX_TITLE);
    if (!title || !mentionsIceEnforcement(`${title} ${item.description}`)) continue;
    candidates.push({
      url,
      title,
      publisher: feed.label,
      published_at: parseDate(item.pubDate),
      discovery_query: `rss:${feed.id}`.slice(0, 120),
    });
  }
  return dedupeCandidates(candidates);
}

export function parseMastodonPayload(payload: unknown, tag: string) {
  if (!Array.isArray(payload)) return [];
  const candidates: DiscoveryCandidate[] = [];
  for (const raw of payload) {
    if (!raw || typeof raw !== 'object') continue;
    const wrapper = raw as { reblog?: unknown; sensitive?: unknown };
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
    const text = stripMarkup(String(status.content ?? '')).slice(0, MAX_TITLE);
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
      publisher: (acct ? `@${acct}` : new URL(url).hostname).slice(0, MAX_PUBLISHER),
      published_at: parseDate(typeof status.created_at === 'string' ? status.created_at : null),
      discovery_query: `mastodon:${tag}`.slice(0, 120),
    });
  }
  return dedupeCandidates(candidates);
}

/** Keep discovery forward-looking; an old wire copy is not a new case. */
export function withinDiscoveryWindow(candidate: DiscoveryCandidate, now = Date.now()) {
  if (!candidate.published_at) return true;
  const published = Date.parse(candidate.published_at);
  return Number.isNaN(published) || published >= now - RECENT_MS;
}

/** Rotate the regional GDELT query so every region is covered over time. */
export function regionalQueryForTick(now = Date.now()) {
  const slot = Math.floor(now / (15 * 60 * 1_000));
  return REGIONAL_DISCOVERY_QUERIES[slot % REGIONAL_DISCOVERY_QUERIES.length];
}

/** Structured, bounded error strings; never a full page or a secret. */
export function shortError(error: unknown, fallback = 'scan failed') {
  const message = error instanceof Error ? error.message : String(error ?? fallback);
  return message.replace(/\s+/g, ' ').trim().slice(0, 300) || fallback;
}
