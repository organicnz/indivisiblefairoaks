import sanitizeHtml from 'sanitize-html';
import type { CityPoint } from '@/components/ice-alerts/types';
import type { IceSourceReportKind } from '@/lib/ice-crawl-types';
import {
  type CityMatcher,
  cleanCityName,
  createCityMatcher,
  extractStateCode,
  isStreetSuffixCityName,
  US_STATE_CODES,
} from '@/lib/rapid-city-match';

export type ExtractedReport = {
  title: string;
  text: string;
  sourceUrl: string;
  publishedAt: string | null;
  city: string | null;
  stateCode: string | null;
  kind: IceSourceReportKind;
  sourceTitle?: string | null;
  imageUrl?: string | null;
};

export type FeedExtraction = {
  title: string;
  text: string;
  sourceUrl: string;
  publishedAt: string | null;
  city: string | null;
  stateCode: string | null;
  kind: IceSourceReportKind;
  sourceTitle: string;
  imageUrl?: string | null;
};

const BLOCK_END = /<\/(?:p|div|li|h[1-6]|blockquote|article|section|tr|td|th)>|<br\s*\/?>/gi;
const DROP_ELEMENTS =
  /<(script|style|noscript|template|svg|canvas|iframe|object|embed)[\s\S]*?<\/\1>/gi;
const MAX_FEED_ITEMS = 10_000;

export function normalizeText(value: string) {
  return value
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Normalize aggressively enough to check that AI quoted the page. */
export function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function decodeHtmlEntities(value: string) {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
}

export function readableText(html: string) {
  const withBreaks = html.replace(DROP_ELEMENTS, ' ').replace(BLOCK_END, '\n');
  return normalizeText(decodeHtmlEntities(withBreaks));
}

export function extractTitle(html: string) {
  const title =
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1] ??
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ??
    '';
  return decodeHtmlEntities(readableText(title)).slice(0, 240);
}

function attribute(tag: string, name: string) {
  return tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? null;
}

export function extractMeta(html: string, key: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const name = attribute(tag, 'property') ?? attribute(tag, 'name');
    if (name?.toLowerCase() === key.toLowerCase()) {
      const content = attribute(tag, 'content');
      if (content) return decodeHtmlEntities(content);
    }
  }
  return null;
}

export function extractPublishedAt(html: string) {
  const candidates = [
    extractMeta(html, 'article:published_time'),
    extractMeta(html, 'datePublished'),
    html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1] ?? null,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

export function extractJsonLdArticleBody(html: string) {
  const scripts =
    html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const script of scripts) {
    const json = script.replace(/^[\s\S]*?>/, '').replace(/<\/script>$/i, '');
    try {
      const parsed: unknown = JSON.parse(json);
      const queue: unknown[] = [parsed];
      while (queue.length > 0) {
        const value = queue.shift();
        if (!value || typeof value !== 'object') continue;
        if (Array.isArray(value)) {
          queue.push(...value);
          continue;
        }
        const record = value as Record<string, unknown>;
        if (typeof record.articleBody === 'string' && record.articleBody.trim()) {
          return normalizeText(record.articleBody);
        }
        if (record['@graph']) queue.push(record['@graph']);
      }
    } catch {
      // Ignore malformed JSON-LD; the HTML extraction still runs.
    }
  }
  return null;
}

export type JsonLdArticle = {
  title: string;
  text: string;
  publishedAt: string | null;
};

/** Collect every JSON-LD article body, not just the first one on the page. */
export function extractJsonLdArticles(html: string): JsonLdArticle[] {
  const scripts =
    html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  const articles: JsonLdArticle[] = [];

  for (const script of scripts) {
    const json = script.replace(/^[\s\S]*?>/, '').replace(/<\/script>$/i, '');
    try {
      const parsed: unknown = JSON.parse(json);
      const queue: unknown[] = [parsed];
      while (queue.length > 0) {
        const value = queue.shift();
        if (!value || typeof value !== 'object') continue;
        if (Array.isArray(value)) {
          queue.push(...value);
          continue;
        }
        const record = value as Record<string, unknown>;
        if (typeof record.articleBody === 'string' && record.articleBody.trim().length >= 40) {
          articles.push({
            title:
              typeof record.headline === 'string'
                ? normalizeText(decodeHtmlEntities(record.headline))
                : typeof record.name === 'string'
                  ? normalizeText(decodeHtmlEntities(record.name))
                  : '',
            text: normalizeText(record.articleBody),
            publishedAt: dateIso(
              typeof record.datePublished === 'string' ? record.datePublished : ''
            ),
          });
        }
        if (record['@graph']) queue.push(record['@graph']);
        if (record.mainEntity) queue.push(record.mainEntity);
        if (record.itemListElement) queue.push(record.itemListElement);
      }
    } catch {
      // Ignore malformed JSON-LD; HTML extraction still runs.
    }
  }

  return articles;
}

export function extractFeedLinks(html: string, baseUrl: string) {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  const found: string[] = [];
  for (const tag of links) {
    const type = attribute(tag, 'type') ?? '';
    const href = attribute(tag, 'href');
    if (!href || !/rss|atom|application\/feed\+json/i.test(type)) continue;
    try {
      const url = new URL(href, baseUrl);
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        found.push(url.toString());
      }
    } catch {
      // Ignore malformed feed discovery links.
    }
  }
  return [...new Set(found)];
}

export function extractNextLinks(html: string, baseUrl: string) {
  const tags = html.match(/<(?:a|(?:[a-z0-9]+:)?link)\b[^>]*>/gi) ?? [];
  const base = new URL(baseUrl);
  const found: string[] = [];
  for (const tag of tags) {
    const rel = attribute(tag, 'rel');
    if (!rel || !/\bnext\b/i.test(rel)) continue;
    const href = attribute(tag, 'href');
    if (!href) continue;
    try {
      const url = new URL(href, baseUrl);
      if (url.origin !== base.origin) continue;
      if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
      url.hash = '';
      found.push(url.toString());
    } catch {
      // Ignore malformed pagination links.
    }
  }
  return [...new Set(found)];
}

export function extractSameOriginLinks(html: string, baseUrl: string) {
  const anchors = [
    ...(html.match(/<a\b[^>]*>/gi) ?? []),
    // Pagination is sometimes declared in the head rather than as an anchor.
    ...(html.match(/<(?:[a-z0-9]+:)?link\b[^>]*>/gi) ?? []).filter((tag) =>
      /\brel\s*=\s*["'][^"']*\bnext\b/i.test(tag)
    ),
  ];
  const base = new URL(baseUrl);
  const found: string[] = [];
  for (const tag of anchors) {
    const href = attribute(tag, 'href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:')) continue;
    try {
      const url = new URL(href, baseUrl);
      if (url.origin !== base.origin) continue;
      url.hash = '';
      if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
      found.push(url.toString());
    } catch {
      // Ignore malformed links.
    }
  }
  return [...new Set(found)];
}

export function extractSitemapLinks(xml: string, baseUrl: string) {
  const locs = [...xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)].map((match) =>
    decodeHtmlEntities(
      match[1]
        .trim()
        .replace(/^<!\[CDATA\[/, '')
        .replace(/\]\]>$/, '')
    ).trim()
  );
  const base = new URL(baseUrl);
  const found: string[] = [];
  for (const value of locs) {
    try {
      const url = new URL(value, baseUrl);
      if (url.origin !== base.origin) continue;
      if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
      url.hash = '';
      found.push(url.toString());
    } catch {
      // Ignore malformed sitemap locations.
    }
  }
  return [...new Set(found)];
}

function readTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!match) return '';
  return decodeHtmlEntities(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim();
}

function readLinkTag(block: string, baseUrl: string) {
  const candidates = [readTag(block, 'link'), readTag(block, 'guid')];
  for (const plain of candidates) {
    if (!plain) continue;
    try {
      const url = new URL(plain, baseUrl);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString();
    } catch {
      // Try the next candidate.
    }
  }
  const atom = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1];
  if (!atom) return null;
  try {
    return new URL(atom, baseUrl).toString();
  } catch {
    return null;
  }
}

function dateIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function classifyReportKind(text: string): IceSourceReportKind {
  if (/\b(checkpoint|roadblock|sobriety|dui)\b/i.test(text)) return 'checkpoint';
  if (/\b(detention|detain|jail|prison|holding facility|processing center)\b/i.test(text)) {
    return 'detention';
  }
  // "Law Enforcement" and the "Immigration and Customs Enforcement" navigation
  // label are not report signals. Require an ICE-specific actor or action.
  if (
    /\b(?:ice|immigration enforcement|agents?|raid|arrest(?:ed|s|ing)?|detain(?:ed|s|ing)?|sighting|operation|sweep|worksite|deport(?:s|ed|ation|ing)?|detainer|apprehend(?:ed|s|ing)?|seiz(?:e|ed|es|ing)|encounter(?:ed|s)?)\b/i.test(
      text
    )
  ) {
    return 'enforcement';
  }
  return 'other';
}

const STREET_SUFFIX =
  /\b(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|hwy|highway|fwy|freeway|pkwy|parkway|ct|court|pl|place|ter|terrace|cir|circle|sq|square|loop|trail|trl|turnpike|route|rte)\b/i;
const CITY_STOP_WORDS = new Set([
  'agent',
  'agents',
  'activity',
  'and',
  'area',
  'at',
  'by',
  'county',
  'crashed',
  'enforcement',
  'exit',
  'for',
  'from',
  'ice',
  'immigration',
  'in',
  'near',
  'of',
  'on',
  'people',
  'person',
  'report',
  'reported',
  'seen',
  'sighting',
  'source',
  'spotted',
  'stopped',
  'the',
  'this',
  'to',
  'today',
  'with',
  'working',
]);

function stopWord(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, '');
}

function cityCandidate(value: string) {
  const words = value
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''))
    .filter(Boolean);
  while (words.length > 0 && CITY_STOP_WORDS.has(stopWord(words[0]))) {
    words.shift();
  }
  const city = titleCaseCity(words.join(' '));
  if (!city || city.length > 80) return null;
  if (!/[a-z]/i.test(city) || /\d/.test(city)) return null;
  if (isStreetSuffixCityName(city)) return null;
  if (STREET_SUFFIX.test(city)) return null;
  for (const word of city.split(' ')) {
    if (CITY_STOP_WORDS.has(stopWord(word))) return null;
  }
  return city;
}

function titleCaseCity(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ');
}

function validState(value: string | null | undefined) {
  const state = value?.toUpperCase() ?? '';
  return US_STATE_CODES.has(state) ? state : null;
}

function cityBeforeState(value: string, stateCode: string) {
  const words = value.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  for (let count = Math.min(4, words.length); count >= 1; count -= 1) {
    const city = cityCandidate(words.slice(-count).join(' '));
    if (city) return city;
  }
  return null;
}

function fallbackCityState(text: string) {
  const comma = text.match(/,\s*([A-Za-z]{2})\b/i);
  if (comma?.index !== undefined) {
    const stateCode = validState(comma[1]);
    const city = stateCode ? cityBeforeState(text.slice(0, comma.index), stateCode) : null;
    if (stateCode && city) return { city, stateCode };
  }

  const withZip = text.match(/\b([A-Za-z]{2})\s*\d{5,9}(?:-\d{4})?\b/i);
  if (withZip?.index !== undefined) {
    const stateCode = validState(withZip[1]);
    const city = stateCode ? cityBeforeState(text.slice(0, withZip.index), stateCode) : null;
    if (stateCode && city) return { city, stateCode };
  }

  const atEnd = text.match(/\b([A-Za-z]{2})\s*$/i);
  if (atEnd?.index !== undefined) {
    const stateCode = validState(atEnd[1]);
    const city = stateCode ? cityBeforeState(text.slice(0, atEnd.index), stateCode) : null;
    if (stateCode && city) return { city, stateCode };
  }

  return { city: null, stateCode: validState(extractStateCode(text)) };
}

function cityStateFromText(text: string, matcher: CityMatcher | null) {
  const stateCode = extractStateCode(text);
  if (!stateCode) return { city: null, stateCode: null };
  if (!matcher) return fallbackCityState(text);
  const match = matcher.findCityInLocation(text, stateCode);
  return match
    ? { city: cleanCityName(match.city.city) ?? match.city.city, stateCode }
    : { city: null, stateCode };
}

export function extractCityState(text: string, cities?: readonly CityPoint[]) {
  const matcher = cities?.length ? createCityMatcher(cities) : null;
  return cityStateFromText(text, matcher);
}

export function isIceReportText(text: string) {
  return (
    /\b(?:ice|immigration and customs enforcement|immigration enforcement|ice agents?)\b/i.test(
      text
    ) &&
    // Do not treat the word "enforcement" alone as a report signal: it appears
    // in the site-wide "Immigration and Customs Enforcement" and "Law
    // Enforcement" navigation labels on every DHS page.
    /\b(?:report(?:ed|s|ing)?|sighting|seen|spotted|activity|raid|checkpoint|arrest(?:ed|s|ing)?|detain(?:ed|s|ing)?|detainer|deport(?:s|ed|ation|ing)?|apprehend(?:ed|s|ing)?|seiz(?:e|ed|es|ing)|encounter(?:ed|s)?|agents?|vehicles?|operation|sweep|worksite)\b/i.test(
      text
    )
  );
}

export function cleanTitle(value: string, fallback: string) {
  const title = normalizeText(decodeHtmlEntities(value)).slice(0, 240);
  if (title.length >= 3) return title;
  return fallback.slice(0, 240);
}

const STOPICE_MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

export function parseStopIceTimestamp(value: string): string | null {
  const match = value
    .trim()
    .match(
      /^([a-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\s*\((\d{1,2}):(\d{2})(?::(\d{2}))?\)\s*(PST|PDT|UTC|GMT)?$/i
    );
  if (!match) return null;
  const monthIndex = STOPICE_MONTHS.indexOf(
    match[1].slice(0, 3).toLowerCase() as (typeof STOPICE_MONTHS)[number]
  );
  if (monthIndex < 0) return null;
  const day = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  const zone = (match[7] ?? 'PST').toUpperCase();
  const offsetHours = zone === 'PDT' ? -7 : zone === 'PST' ? -8 : 0;
  const localDate = new Date(Date.UTC(year, monthIndex, day));
  if (localDate.getUTCFullYear() !== year || localDate.getUTCMonth() !== monthIndex) {
    return null;
  }
  if (localDate.getUTCDate() !== day) return null;
  const timestamp = Date.UTC(year, monthIndex, day, hour - offsetHours, minute, second);
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Parse StopICE's custom <report_data> export without dropping any records. */
export function extractStopIceReports(
  xml: string,
  feedUrl: string,
  cities?: readonly CityPoint[]
): FeedExtraction[] {
  const blocks = [...xml.matchAll(/<report_data\b[^>]*>([\s\S]*?)<\/report_data>/gi)]
    .slice(0, MAX_FEED_ITEMS)
    .map((match) => match[1]);
  const items: FeedExtraction[] = [];
  const matcher = cities?.length ? createCityMatcher(cities) : null;

  for (const block of blocks) {
    const text = readableText(readTag(block, 'comments'));
    if (text.length < 20) continue;
    const location = readTag(block, 'location');
    const rawUrl = readTag(block, 'url');
    let sourceUrl = feedUrl;
    try {
      const candidate = new URL(rawUrl, feedUrl);
      if (candidate.protocol === 'https:') sourceUrl = candidate.toString();
    } catch {
      // Keep the feed URL as the source when a report URL is malformed.
    }
    const { city, stateCode } = cityStateFromText(location, matcher);
    const title = `Source report: ${location || 'ICE activity'}`;
    items.push({
      title,
      text,
      sourceUrl,
      publishedAt: parseStopIceTimestamp(readTag(block, 'timestamp')),
      city,
      stateCode,
      kind: classifyReportKind(`${location} ${text}`),
      sourceTitle: title,
    });
  }

  return items;
}

export function extractFeedItems(
  xml: string,
  feedUrl: string,
  cities?: readonly CityPoint[]
): FeedExtraction[] {
  const matcher = cities?.length ? createCityMatcher(cities) : null;
  const blocks = [
    ...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi),
    ...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi),
  ]
    .slice(0, MAX_FEED_ITEMS)
    .map((match) => match[1]);

  const items: FeedExtraction[] = [];
  for (const block of blocks) {
    const sourceUrl = readLinkTag(block, feedUrl);
    const rawTitle = readTag(block, 'title');
    const rawText =
      readTag(block, 'content:encoded') ||
      readTag(block, 'content') ||
      readTag(block, 'description') ||
      readTag(block, 'summary');
    const text = readableText(rawText);
    if (!sourceUrl || text.length < 20) continue;
    if (!isIceReportText(`${rawTitle} ${text}`)) continue;
    const { city, stateCode } = cityStateFromText(`${rawTitle} ${text}`, matcher);
    const title = cleanTitle(rawTitle, 'Source report');
    items.push({
      title,
      text,
      sourceUrl,
      publishedAt: dateIso(
        readTag(block, 'pubDate') || readTag(block, 'published') || readTag(block, 'updated')
      ),
      city,
      stateCode,
      kind: classifyReportKind(`${title} ${text}`),
      sourceTitle: title,
      imageUrl: feedImageUrl(block, feedUrl),
    });
  }
  return items;
}

/** Parse a JSON Feed (application/feed+json), which uses JSON rather than RSS/Atom. */
export function extractJsonFeedNextUrl(json: string, feedUrl: string): string | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    const nextUrl = (parsed as Record<string, unknown>).next_url;
    if (typeof nextUrl !== 'string' || !nextUrl.trim()) return null;
    const url = new URL(nextUrl, feedUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.origin !== new URL(feedUrl).origin) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function extractJsonFeedItems(
  json: string,
  feedUrl: string,
  cities?: readonly CityPoint[]
): FeedExtraction[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== 'object') return [];
  const source = parsed as Record<string, unknown>;
  const items = Array.isArray(source.items) ? source.items.slice(0, MAX_FEED_ITEMS) : [];
  const matcher = cities?.length ? createCityMatcher(cities) : null;
  const extracted: FeedExtraction[] = [];

  for (const value of items) {
    if (!value || typeof value !== 'object') continue;
    const item = value as Record<string, unknown>;
    const rawUrl =
      typeof item.url === 'string' ? item.url : typeof item.id === 'string' ? item.id : '';
    let sourceUrl = '';
    try {
      const candidate = new URL(rawUrl, feedUrl);
      if (candidate.protocol === 'https:' || candidate.protocol === 'http:') {
        sourceUrl = candidate.toString();
      }
    } catch {
      // A non-URL GUID is not a source URL.
    }
    const rawTitle = typeof item.title === 'string' ? item.title : '';
    const rawText =
      (typeof item.content_html === 'string' && item.content_html) ||
      (typeof item.content_text === 'string' && item.content_text) ||
      (typeof item.summary === 'string' && item.summary) ||
      '';
    const text = readableText(rawText);
    if (!sourceUrl || text.length < 20 || !isIceReportText(`${rawTitle} ${text}`)) continue;
    const { city, stateCode } = cityStateFromText(`${rawTitle} ${text}`, matcher);
    const title = cleanTitle(rawTitle, 'Source report');
    extracted.push({
      title,
      text,
      sourceUrl,
      publishedAt: dateIso(
        typeof item.date_published === 'string'
          ? item.date_published
          : typeof item.date_modified === 'string'
            ? item.date_modified
            : ''
      ),
      city,
      stateCode,
      kind: classifyReportKind(`${title} ${text}`),
      sourceTitle: title,
      imageUrl: jsonFeedImageUrl(item, feedUrl),
    });
  }

  return extracted;
}

function absoluteImageUrl(raw: string | undefined, baseUrl: string) {
  if (!raw) return null;
  try {
    const url = new URL(raw, baseUrl);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** RSS/Atom image carriers, in the order publishers actually use them. */
function feedImageUrl(block: string, baseUrl: string) {
  const tags = [...block.matchAll(/<(?:media:content|media:thumbnail|enclosure|image)\b[^>]*>/gi)];
  for (const [tag] of tags) {
    const type = /\btype\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? '';
    if (type && !type.toLowerCase().startsWith('image/')) continue;
    const raw =
      /\burl\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ??
      /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    const resolved = absoluteImageUrl(raw, baseUrl);
    if (resolved) return resolved;
  }
  const nested = /<image\b[^>]*>[\s\S]*?<url>([^<]+)<\/url>/i.exec(block)?.[1];
  return absoluteImageUrl(nested, baseUrl);
}

function jsonFeedImageUrl(item: Record<string, unknown>, baseUrl: string) {
  const direct =
    (typeof item.image === 'string' && item.image) ||
    (typeof item.banner_image === 'string' && item.banner_image) ||
    (item.image && typeof item.image === 'object'
      ? typeof (item.image as Record<string, unknown>).url === 'string'
        ? ((item.image as Record<string, unknown>).url as string)
        : null
      : null);
  const resolved = absoluteImageUrl(direct || undefined, baseUrl);
  if (resolved) return resolved;
  const attachments = Array.isArray(item.attachments) ? item.attachments : [];
  for (const attachment of attachments) {
    if (!attachment || typeof attachment !== 'object') continue;
    const row = attachment as Record<string, unknown>;
    if (typeof row.mime_type === 'string' && !row.mime_type.startsWith('image/')) continue;
    if (typeof row.url === 'string') {
      const candidate = absoluteImageUrl(row.url, baseUrl);
      if (candidate) return candidate;
    }
  }
  return null;
}

export function extractHtmlReport(
  html: string,
  pageUrl: string,
  cities?: readonly CityPoint[]
): ExtractedReport | null {
  const sourceTitle = extractTitle(html);
  const articleBody = extractJsonLdArticleBody(html);
  const articleHtml =
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ??
    html;
  const text = articleBody || readableText(articleHtml);
  if (text.length < 20 || !isIceReportText(`${sourceTitle} ${text}`)) return null;

  const { city, stateCode } = extractCityState(`${sourceTitle}\n${text}`, cities);
  return {
    title: cleanTitle(sourceTitle, 'Source report'),
    text,
    sourceUrl: pageUrl,
    publishedAt: extractPublishedAt(html),
    city,
    stateCode,
    kind: classifyReportKind(`${sourceTitle}\n${text}`),
    sourceTitle,
  };
}

/**
 * Extract every article-like block on a page. News sites often put several
 * separate reports in one listing page; taking only the first <article> loses
 * the rest even when the page is small.
 */
export function extractHtmlReports(
  html: string,
  pageUrl: string,
  cities?: readonly CityPoint[],
  includeBodyFallback = true
): ExtractedReport[] {
  const pageTitle = extractTitle(html);
  const pagePublishedAt = extractPublishedAt(html);
  const blocks = [...(html.match(/<article\b[^>]*>[\s\S]*?<\/article>/gi) ?? [])];
  if (blocks.length === 0) {
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
    if (main) blocks.push(main);
  }

  const reports: ExtractedReport[] = [];

  const add = (title: string, text: string, publishedAt: string | null) => {
    if (text.length < 20 || !isIceReportText(`${title}\n${text}`)) return;
    const { city, stateCode } = extractCityState(`${title}\n${text}`, cities);
    reports.push({
      title: cleanTitle(title, pageTitle || 'Source report'),
      text,
      sourceUrl: pageUrl,
      publishedAt: publishedAt ?? pagePublishedAt,
      city,
      stateCode,
      kind: classifyReportKind(`${title}\n${text}`),
      sourceTitle: pageTitle || null,
    });
  };

  for (const block of blocks) {
    add(extractTitle(block) || pageTitle, readableText(block), null);
  }

  for (const article of extractJsonLdArticles(html)) {
    add(article.title || pageTitle, article.text, article.publishedAt);
  }

  if (reports.length === 0 && includeBodyFallback) {
    const single = extractHtmlReport(html, pageUrl, cities);
    if (single) reports.push(single);
  }

  return mergeExtractedReports([], reports);
}

/**
 * Deduplicate reports by normalized text and drop reports that are fully
 * contained in a more complete excerpt. This is what keeps overlapping AI
 * chunks from publishing the same report twice.
 */
export function mergeExtractedReports(
  primary: readonly ExtractedReport[],
  secondary: readonly ExtractedReport[]
): ExtractedReport[] {
  const merged = [...primary];
  const normalized = merged.map((report) => normalizeForMatch(report.text));

  for (const candidate of secondary) {
    const candidateText = normalizeForMatch(candidate.text);
    if (candidateText.length < 20) continue;
    const overlapIndex = normalized.findIndex(
      (existing) =>
        existing === candidateText ||
        existing.includes(candidateText) ||
        candidateText.includes(existing)
    );
    if (overlapIndex >= 0) {
      // Keep the more complete source text when the same report appears as a
      // short AI excerpt and a full article paragraph.
      if (candidateText.length > normalized[overlapIndex].length) {
        merged[overlapIndex] = candidate;
        normalized[overlapIndex] = candidateText;
      }
      continue;
    }
    merged.push(candidate);
    normalized.push(candidateText);
  }

  return merged;
}

/** Validate that an AI-returned excerpt is verbatim text from the source page. */
export function verbatimExcerpt(pageText: string, excerpt: string) {
  const normalizedPage = normalizeForMatch(pageText);
  const normalizedExcerpt = normalizeForMatch(excerpt);
  if (normalizedExcerpt.length < 20) return false;
  return normalizedPage.includes(normalizedExcerpt);
}
