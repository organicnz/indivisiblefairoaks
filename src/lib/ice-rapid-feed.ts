import type {
  OfficialRelease,
  RapidAlert,
  RapidAlertKind,
  RapidAlertStatus,
  RapidFeed,
  RapidFeedBase,
  RapidFeedSource,
} from '@/components/ice-alerts/rapid-types';
import type { CityPoint } from '@/components/ice-alerts/types';
import { FUTURE_ALERT_TOLERANCE_MS } from '@/components/ice-alerts/rapid-alert-utils';
import { getIceHeatmapSnapshot } from '@/lib/queries/ice-heatmap';
import {
  persistRapidFeed,
  readPersistedRapidFeed,
  type PersistedRapidFeed,
} from '@/lib/queries/ice-rapid-cache';
import { createCityMatcher, extractStateCode } from './rapid-city-match';

const STOPICE_HOME = 'https://stopice.net/';
const STOPICE_DATA_INDEX = 'https://stopice.net/?data=1';
const STOPICE_SOURCE_NAME = 'Stop ICE Alerts Network';
const ICE_NEWSROOM_RSS = 'https://www.ice.gov/rss/ice-breaking-news';
const ICE_SOURCE_NAME = 'ICE Newsroom';
const ICE_SOURCE_URL = 'https://www.ice.gov/newsroom';
const FETCH_TIMEOUT_MS = 8_000;
// Bound all community-export discovery and download attempts. The direct
// monthly file is normally the only request; this deadline prevents a moved
// file or a bad index from turning one cold render into a chain of timeouts.
const COMMUNITY_BUDGET_MS = 14_000;
const INDEX_TIMEOUT_MS = 6_000;
const FETCH_RETRY_DELAY_MS = 250;
const MAX_COMMUNITY_BYTES = 4_000_000;
const MAX_OFFICIAL_BYTES = 1_000_000;
const ACTIVE_WINDOW_MS = 4 * 60 * 60 * 1000;
/*
 * Stop ICE compiles its public export nightly. Freshness therefore belongs to
 * the export file, not to its newest report: a healthy nightly file can legit-
 * imately have no reports for a day. Allow six hours of grace past the nightly
 * cadence before calling the file delayed. If the source does not expose
 * Last-Modified, fall back to the report age and the shorter six-hour window.
 */
const COMMUNITY_EXPORT_MAX_AGE_MS = 30 * 60 * 60 * 1000;
const COMMUNITY_REPORT_FALLBACK_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const OFFICIAL_FRESH_MS = 14 * 24 * 60 * 60 * 1000;
const MEMORY_CACHE_MS = 60_000;
// A snapshot younger than this is preferable to a cold upstream build on a new
// serverless instance. The upstream community export is nightly, so a quarter
// hour of cache does not change what the map represents.
const PERSISTED_CACHE_FRESH_MS = 15 * 60 * 1000;
// Keep a week of last-known-good data available through an upstream outage.
const PERSISTED_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MONTHS = [
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

type FetchOptions = {
  revalidate: number;
  maxBytes: number;
  timeoutMs?: number;
  retries?: number;
  /** Absolute deadline shared by a multi-request source resolution. */
  deadline?: number;
};

type FetchedText = {
  text: string;
  /** Parsed upstream Last-Modified header, or null when absent/invalid. */
  lastModifiedMs: number | null;
};

type CommunityParseResult = {
  alerts: RapidAlert[];
  latestAt: string | null;
  scanned: number;
  skipped: number;
};

type OfficialParseResult = {
  releases: OfficialRelease[];
  latestAt: string | null;
};

export type RapidFeedOrigin = 'memory' | 'durable' | 'live';

export type RapidFeedMeta = {
  /** Where this response's feed object came from. */
  source: RapidFeedOrigin;
  /** Whole seconds since `feed.generatedAt`; never negative. */
  ageSeconds: number;
  /** Whole seconds since this cache entry was created; 0 for a live build. */
  cacheAgeSeconds: number;
  /**
   * True when a usable but stale durable snapshot was served. The route should
   * return it immediately and rebuild in the background instead of blocking the
   * visitor on the upstream sources.
   */
  refreshRecommended: boolean;
};

export type RapidFeedResult = {
  feed: RapidFeedBase;
  meta: RapidFeedMeta;
};

let memoryCache: { at: number; feed: RapidFeedBase } | null = null;
const inFlight = new Map<'fresh' | 'cached', Promise<RapidFeedResult>>();

function wholeSeconds(ms: number): number {
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
}

function feedAgeSeconds(feed: RapidFeedBase, now: number): number {
  const generatedMs = Date.parse(feed.generatedAt);
  return Number.isFinite(generatedMs) ? wholeSeconds(now - generatedMs) : 0;
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .trim();
}

function readTag(block: string, tag: string) {
  const match = block.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i')
  );
  return match ? decodeXml(match[1]) : '';
}

function stripHtml(value: string) {
  return decodeXml(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function safeSourceUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return STOPICE_HOME;
    if (url.hostname !== 'stopice.net' && url.hostname !== 'www.stopice.net') {
      return STOPICE_HOME;
    }
    return url.toString();
  } catch {
    return STOPICE_HOME;
  }
}

/**
 * Parse the timestamp format used by the public Stop ICE export:
 * "nov 14, 2026 (21:00:02) PST".
 */
export function parseCommunityTimestamp(value: string): string | null {
  const match = value
    .trim()
    .match(
      /^([a-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\s*\((\d{1,2}):(\d{2})(?::(\d{2}))?\)\s*(PST|PDT|UTC|GMT)?$/i
    );
  if (!match) return null;

  const monthIndex = MONTHS.indexOf(match[1].slice(0, 3).toLowerCase() as (typeof MONTHS)[number]);
  if (monthIndex < 0) return null;

  const day = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);
  const zone = (match[7] ?? 'PST').toUpperCase();
  const offsetHours = zone === 'PDT' ? -7 : zone === 'PST' ? -8 : 0;

  if (hour > 23 || minute > 59 || second > 59) return null;

  // Validate the local calendar day before applying the zone offset; a late
  // Pacific report can roll over to the next UTC day.
  const localDate = new Date(Date.UTC(year, monthIndex, day));
  if (localDate.getUTCFullYear() !== year || localDate.getUTCMonth() !== monthIndex) {
    return null;
  }
  if (localDate.getUTCDate() !== day) return null;

  const timestamp = Date.UTC(
    year,
    monthIndex,
    day,
    hour - offsetHours,
    minute,
    second
  );
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function classifyKind(priority: string, comments: string): RapidAlertKind {
  const text = `${priority} ${comments}`.toLowerCase();
  if (/\b(checkpoint|sobriety|roadblock|dui)\b/.test(text)) return 'checkpoint';
  if (
    /\b(jail|prison|detention|detain|irc|mdc|processing center|holding facility)\b/.test(
      text
    )
  ) {
    return 'detention';
  }
  return 'enforcement';
}

function statusForPriority(priority: string): RapidAlertStatus {
  return /urgent|confirmed/i.test(priority) ? 'source-confirmed' : 'sighting';
}

function communitySummary(
  kind: RapidAlertKind,
  status: RapidAlertStatus,
  city: string,
  stateCode: string
) {
  const label =
    status === 'source-confirmed' ? 'Source-confirmed enforcement activity' : 'Community sighting';
  const place = `${city}, ${stateCode}`;

  if (kind === 'detention') {
    return `${label} reported near a jail or detention facility in ${place}. Location is generalized to the city; street addresses, vehicle plates, and identities are not republished.`;
  }
  if (kind === 'checkpoint') {
    return `${label} reported near a possible checkpoint in ${place}. Location is generalized to the city; street addresses, vehicle plates, and identities are not republished.`;
  }
  return `${label} reported in ${place}. Location is generalized to the city; street addresses, vehicle plates, and identities are not republished.`;
}

function communityTitle(kind: RapidAlertKind, status: RapidAlertStatus) {
  const kindLabel =
    kind === 'detention' ? 'Detention report' : kind === 'checkpoint' ? 'Checkpoint report' : 'Enforcement report';
  return status === 'source-confirmed' ? `Source-confirmed ${kindLabel.toLowerCase()}` : `Community ${kindLabel.toLowerCase()}`;
}

/**
 * Parse the public community export while retaining only fields that are safe
 * to republish. Raw comments, street addresses, plates, media URLs, and names
 * never leave this function.
 */
export function parseStopIceCommunityFeed(
  xml: string,
  options: {
    cities: readonly CityPoint[];
    now?: Date;
    limit?: number;
    scanLimit?: number;
  }
): CommunityParseResult {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 100;
  const scanLimit = options.scanLimit ?? 500;
  const futureCutoff = now.getTime() + FUTURE_ALERT_TOLERANCE_MS;
  const matcher = createCityMatcher(options.cities);
  const blocks = [...xml.matchAll(/<report_data>([\s\S]*?)<\/report_data>/gi)]
    .slice(0, scanLimit)
    .map((match) => match[1]);

  const alerts: RapidAlert[] = [];
  let skipped = 0;

  for (const block of blocks) {
    const location = readTag(block, 'location');
    const rawTimestamp = readTag(block, 'timestamp');
    const observedAt = parseCommunityTimestamp(rawTimestamp);
    const match = matcher.findCityInLocation(location, extractStateCode(location));

    const observedMs = observedAt ? Date.parse(observedAt) : Number.NaN;
    if (
      !match ||
      !observedAt ||
      !Number.isFinite(observedMs) ||
      observedMs > futureCutoff
    ) {
      skipped += 1;
      continue;
    }

    const priority = readTag(block, 'thispriority');
    const status = statusForPriority(priority);
    const kind = classifyKind(priority, readTag(block, 'comments'));
    const city = match.city;
    const id = readTag(block, 'id') || `${city.city}-${observedAt}`;

    alerts.push({
      id: `stopice-${id}`,
      source: 'community',
      sourceName: STOPICE_SOURCE_NAME,
      sourceUrl: safeSourceUrl(readTag(block, 'url')),
      kind,
      status,
      title: communityTitle(kind, status),
      city: city.city,
      stateCode: city.stateCode,
      place: `${city.city}, ${city.stateCode}`,
      lat: city.lat,
      lng: city.lng,
      observedAt,
      expiresAt: new Date(new Date(observedAt).getTime() + ACTIVE_WINDOW_MS).toISOString(),
      summary: communitySummary(kind, status, city.city, city.stateCode),
    });
  }

  alerts.sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
  const limited = alerts.slice(0, limit);
  const latestAt = limited[0]?.observedAt ?? null;

  return {
    alerts: limited,
    latestAt,
    scanned: blocks.length,
    skipped: skipped + Math.max(0, alerts.length - limited.length),
  };
}

function officialTopic(title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();

  if (/\bdetainer\b/.test(text)) {
    return 'Immigration detainer release';
  }
  if (/\b(arrest|arrested|apprehend|captur)/.test(text)) {
    return 'Enforcement arrest release';
  }
  if (/\b(remove|removal|deport|repatriat)/.test(text)) {
    return 'Removal release';
  }
  if (/\b(operation|seiz|narcotic|smuggl|traffick)/.test(text)) {
    return 'Enforcement operation release';
  }
  if (/\b(detain|detention|jail|prison)/.test(text)) {
    return 'Detention release';
  }
  if (/\b(statement|announce|policy|directive|rule|expand|program)/.test(text)) {
    return 'Agency statement';
  }

  return 'Official ICE news release';
}

export function parseIceNewsroomRss(
  xml: string,
  options: { limit?: number } = {}
): OfficialParseResult {
  const limit = options.limit ?? 18;
  const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .slice(0, Math.max(limit, 1) * 2)
    .map((match) => match[1]);

  const releases: OfficialRelease[] = [];

  for (const block of blocks) {
    const rawTitle = stripHtml(readTag(block, 'title'));
    const link = readTag(block, 'link');
    const rawDate = readTag(block, 'pubDate');
    const publishedAt = new Date(rawDate);
    const rawDescription = stripHtml(readTag(block, 'description'));
    const guid = readTag(block, 'guid');

    if (!rawTitle || !link.startsWith('https://www.ice.gov/')) continue;
    if (Number.isNaN(publishedAt.getTime())) continue;

    releases.push({
      id: `ice-${(guid || rawTitle).slice(0, 64).trim().replace(/[^a-z0-9_-]+/gi, '-')}`,
      sourceName: ICE_SOURCE_NAME,
      sourceUrl: link,
      // ICE release titles and descriptions can contain names and case details.
      // This page classifies the topic and links out instead of reproducing them.
      title: officialTopic(rawTitle, rawDescription),
      summary:
        "Open the official release for ICE's full account. This page summarizes the topic without reproducing names or case details.",
      publishedAt: publishedAt.toISOString(),
    });
  }

  releases.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  return {
    releases: releases.slice(0, limit),
    latestAt: releases[0]?.publishedAt ?? null,
  };
}

class SourceRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = 'SourceRequestError';
  }
}

function retryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTextResult(
  url: string,
  options: FetchOptions,
  attempt = 0
): Promise<FetchedText> {
  const remaining = options.deadline ? options.deadline - Date.now() : Number.POSITIVE_INFINITY;
  if (remaining < 500) {
    throw new SourceRequestError('Source budget exhausted', false);
  }

  const controller = new AbortController();
  const timeoutMs = Math.min(options.timeoutMs ?? FETCH_TIMEOUT_MS, remaining);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8',
        'User-Agent': 'IndivisibleFairOaks-ICERapidResponse/1.0 (+https://indivisiblefairoaks.org)',
      },
      next: { revalidate: options.revalidate },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new SourceRequestError(
        `Source returned ${response.status}`,
        retryableStatus(response.status)
      );
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > options.maxBytes) {
      throw new SourceRequestError('Source payload is larger than the allowed limit', false);
    }

    const text = await response.text();
    if (text.length > options.maxBytes) {
      throw new SourceRequestError('Source payload is larger than the allowed limit', false);
    }
    const rawLastModified = response.headers.get('last-modified');
    const lastModifiedMs = rawLastModified ? Date.parse(rawLastModified) : Number.NaN;
    return {
      text,
      lastModifiedMs: Number.isFinite(lastModifiedMs) ? lastModifiedMs : null,
    };
  } catch (error) {
    const retryable =
      error instanceof SourceRequestError ? error.retryable : !controller.signal.aborted;
    const retries = options.retries ?? 0;
    const retryFitsBudget =
      !options.deadline || Date.now() + FETCH_RETRY_DELAY_MS + 500 < options.deadline;
    if (attempt < retries && retryable && retryFitsBudget) {
      clearTimeout(timer);
      await sleep(FETCH_RETRY_DELAY_MS);
      return fetchTextResult(url, options, attempt + 1);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(
  url: string,
  options: FetchOptions,
  attempt = 0
): Promise<string> {
  return (await fetchTextResult(url, options, attempt)).text;
}

function monthlyFileCandidates(now: Date) {
  const candidates: string[] = [];
  for (let offset = 0; offset < 3; offset += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const month = MONTHS[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    candidates.push(
      `https://stopice.net/login/data/stats/stopicenet_${month}_${year}_complete.xml`
    );
  }
  return candidates;
}

type CommunityDocument = {
  url: string;
  xml: string;
  lastModifiedMs: number | null;
};

function trustedCommunityUrl(path: string): string | null {
  try {
    const candidate = new URL(path, STOPICE_HOME);
    if (
      candidate.protocol === 'https:' &&
      (candidate.hostname === 'stopice.net' || candidate.hostname === 'www.stopice.net')
    ) {
      return candidate.toString();
    }
  } catch {
    // Ignore malformed index links and keep looking.
  }
  return null;
}

async function fetchFirstCommunityDocument(
  urls: readonly string[],
  deadline: number
): Promise<CommunityDocument | null> {
  for (const url of urls) {
    const remaining = deadline - Date.now();
    if (remaining < 500) break;
    try {
      const fetched = await fetchTextResult(url, {
        revalidate: 300,
        maxBytes: MAX_COMMUNITY_BYTES,
        timeoutMs: Math.min(FETCH_TIMEOUT_MS, remaining),
        deadline,
      });
      return {
        url,
        xml: fetched.text,
        lastModifiedMs: fetched.lastModifiedMs,
      };
    } catch {
      // Try the next known-good file. A new month can be published late and
      // the public index/markup can move independently of the data files.
    }
  }
  return null;
}

/**
 * Resolve and download the public community export once. The predictable
 * monthly file is tried first because the index is a larger HTML page; the
 * index is the fallback when the filename pattern changes.
 */
async function fetchCommunityDocument(now: Date): Promise<CommunityDocument> {
  const deadline = Date.now() + COMMUNITY_BUDGET_MS;
  const tried = new Set<string>();
  const directUrls = monthlyFileCandidates(now);
  for (const url of directUrls) tried.add(url);
  const direct = await fetchFirstCommunityDocument(directUrls, deadline);
  if (direct) return direct;

  try {
    const indexRemaining = deadline - Date.now();
    if (indexRemaining < 500) throw new Error('Community source budget exhausted');
    const index = await fetchText(STOPICE_DATA_INDEX, {
      revalidate: 900,
      maxBytes: 1_500_000,
      timeoutMs: Math.min(INDEX_TIMEOUT_MS, indexRemaining),
      retries: 1,
      deadline,
    });
    const discovered = [
      ...index.matchAll(
        /href=["']?([^"'\s>]*stopicenet_[a-z]{3}_\d{4}_complete\.xml)/gi
      ),
    ]
      .map((match) => trustedCommunityUrl(match[1]))
      .filter((url): url is string => url !== null && !tried.has(url));

    const fromIndex = await fetchFirstCommunityDocument(discovered, deadline);
    if (fromIndex) return fromIndex;
  } catch (error) {
    console.warn('Unable to inspect the community data index', error);
  }

  throw new Error('No community data file is available');
}

function sourceState(
  sourceName: string,
  sourceUrl: string,
  itemCount: number,
  latestAt: string | null,
  status: RapidFeed['community']['status'],
  note: string
): RapidFeedSource {
  return {
    status,
    sourceName,
    sourceUrl,
    checkedAt: new Date().toISOString(),
    latestAt,
    itemCount,
    note,
  };
}

async function fetchCommunity(now: Date, citiesPromise: Promise<readonly CityPoint[]>) {
  try {
    const [cities, document] = await Promise.all([
      citiesPromise,
      fetchCommunityDocument(now),
    ]);
    if (cities.length === 0) {
      throw new Error('The Supabase ICE city reference snapshot is unavailable');
    }
    const parsed = parseStopIceCommunityFeed(document.xml, {
      cities,
      now,
      limit: 100,
      scanLimit: 600,
    });
    const latestAt = parsed.latestAt;
    const latestMs = latestAt ? Date.parse(latestAt) : Number.NaN;
    const latestLabel = Number.isFinite(latestMs)
      ? new Date(latestMs).toUTCString()
      : 'an unknown time';
    const reportAge = Number.isFinite(latestMs)
      ? now.getTime() - latestMs
      : Number.POSITIVE_INFINITY;

    // A nightly export is current when its file was recently refreshed, even
    // if it happens to contain no report from the last few hours. Only mark it
    // delayed when the file itself is overdue, or when even the newest parsed
    // report is older than a full nightly cycle (which catches a cache serving
    // fresh headers for stale content).
    const modifiedMs = document.lastModifiedMs;
    const exportAge = modifiedMs !== null ? now.getTime() - modifiedMs : reportAge;
    const exportAgeLimit =
      modifiedMs !== null
        ? COMMUNITY_EXPORT_MAX_AGE_MS
        : COMMUNITY_REPORT_FALLBACK_MAX_AGE_MS;
    const exportIsDelayed = exportAge > exportAgeLimit;
    const reportsAreDelayed = reportAge > COMMUNITY_EXPORT_MAX_AGE_MS;
    const stale = exportIsDelayed || reportsAreDelayed;
    const note = !stale
      ? 'Public nightly export. Locations are generalized to the nearest known city; raw details are withheld.'
      : modifiedMs !== null && exportIsDelayed
        ? `Delayed community export: the public data file has not updated since ${new Date(
            modifiedMs
          ).toUTCString()}. The newest report is from ${latestLabel}. Older reports remain visible in the feed and on the map; they are not treated as active.`
        : `Delayed community export: the newest report is from ${latestLabel}, older than the expected nightly window. Older reports remain visible in the feed and on the map; they are not treated as active.`;

    // Delayed only changes the label: keep the parsed alerts so older reports
    // remain available in the feed and map.
    return {
      alerts: parsed.alerts,
      source: sourceState(
        STOPICE_SOURCE_NAME,
        document.url,
        parsed.alerts.length,
        latestAt,
        stale ? 'stale' : 'ok',
        note
      ),
    };
  } catch (error) {
    console.warn('Unable to load the community rapid-response feed', error);
    return {
      alerts: [],
      source: sourceState(
        STOPICE_SOURCE_NAME,
        STOPICE_DATA_INDEX,
        0,
        null,
        'unavailable',
        'The public community export or its Supabase city reference data could not be loaded. No community pins are being shown.'
      ),
    };
  }
}

async function fetchOfficial(now: Date) {
  try {
    const xml = await fetchText(ICE_NEWSROOM_RSS, {
      revalidate: 300,
      maxBytes: MAX_OFFICIAL_BYTES,
      retries: 1,
    });
    const parsed = parseIceNewsroomRss(xml, { limit: 18 });
    const latestAt = parsed.latestAt;
    const age = latestAt ? now.getTime() - Date.parse(latestAt) : Number.POSITIVE_INFINITY;
    const stale = age > OFFICIAL_FRESH_MS;

    return {
      releases: parsed.releases,
      source: sourceState(
        ICE_SOURCE_NAME,
        ICE_SOURCE_URL,
        parsed.releases.length,
        latestAt,
        stale ? 'stale' : 'ok',
        'Official agency releases from the ICE newsroom RSS feed. Topics are summarized; open a release for the agency’s full text. These are not live enforcement locations.'
      ),
    };
  } catch (error) {
    console.warn('Unable to load the official ICE newsroom feed', error);
    return {
      releases: [],
      source: sourceState(
        ICE_SOURCE_NAME,
        ICE_SOURCE_URL,
        0,
        null,
        'unavailable',
        'The official ICE newsroom feed could not be reached. No official releases are being shown.'
      ),
    };
  }
}

/**
 * Build the public feed and retain where the returned snapshot came from. This
 * is the route-facing form; `getRapidFeed` remains the feed-only API used by
 * the surge cron and existing callers.
 */
export async function getRapidFeedResult(
  options: { fresh?: boolean } = {}
): Promise<RapidFeedResult> {
  const mode = options.fresh ? 'fresh' : 'cached';
  const now = Date.now();

  if (mode === 'cached' && memoryCache && now - memoryCache.at < MEMORY_CACHE_MS) {
    return {
      feed: memoryCache.feed,
      meta: {
        source: 'memory',
        ageSeconds: feedAgeSeconds(memoryCache.feed, now),
        cacheAgeSeconds: wholeSeconds(now - memoryCache.at),
        refreshRecommended: false,
      },
    };
  }
  const pending = inFlight.get(mode);
  if (pending) return pending;

  const request = resolveRapidFeed(options.fresh === true).finally(() => {
    if (inFlight.get(mode) === request) inFlight.delete(mode);
  });
  inFlight.set(mode, request);
  return request;
}

/**
 * Build the public feed. A source failure never turns into invented data; it is
 * reported as unavailable so the UI can be explicit about what is missing.
 */
export async function getRapidFeed(
  options: { fresh?: boolean } = {}
): Promise<RapidFeedBase> {
  return (await getRapidFeedResult(options)).feed;
}

export function hasUsableRapidFeed(feed: RapidFeedBase): boolean {
  return (
    feed.alerts.length > 0 ||
    feed.officialReleases.length > 0 ||
    feed.community.status !== 'unavailable' ||
    feed.official.status !== 'unavailable'
  );
}

function fallbackSource(
  current: RapidFeedSource,
  previous: RapidFeedSource,
  fetchedAt: string,
  reason: string
): RapidFeedSource {
  return {
    ...previous,
    status: 'stale',
    checkedAt: current.checkedAt,
    note: `${reason} Showing the last successful snapshot from ${new Date(
      fetchedAt
    ).toUTCString()}.`,
  };
}

function staleSource(source: RapidFeedSource, fetchedAt: string): RapidFeedSource {
  if (source.status === 'unavailable') return source;

  const fetchedLabel = new Date(fetchedAt).toUTCString();
  return {
    ...source,
    status: 'stale',
    note: `${source.note} Showing the last successful snapshot from ${fetchedLabel} while a fresh snapshot is built.`,
  };
}

function markStaleSnapshot(feed: RapidFeedBase, fetchedAt: string): RapidFeedBase {
  return {
    ...feed,
    community: staleSource(feed.community, fetchedAt),
    official: staleSource(feed.official, fetchedAt),
  };
}

async function resolveRapidFeed(fresh: boolean): Promise<RapidFeedResult> {
  const persisted = await readPersistedRapidFeed(PERSISTED_CACHE_MAX_AGE_MS);
  const now = Date.now();
  const fetchedMs = persisted ? Date.parse(persisted.fetchedAt) : Number.NaN;
  const cacheAgeMs = Number.isFinite(fetchedMs) ? now - fetchedMs : Number.NaN;

  if (!fresh && persisted && hasUsableRapidFeed(persisted.feed) && Number.isFinite(cacheAgeMs)) {
    if (cacheAgeMs <= PERSISTED_CACHE_FRESH_MS) {
      memoryCache = { at: now, feed: persisted.feed };
      return {
        feed: persisted.feed,
        meta: {
          source: 'durable',
          ageSeconds: feedAgeSeconds(persisted.feed, now),
          cacheAgeSeconds: wholeSeconds(cacheAgeMs),
          refreshRecommended: false,
        },
      };
    }

    if (cacheAgeMs <= PERSISTED_CACHE_MAX_AGE_MS) {
      // Serve the usable snapshot immediately. The route schedules a fresh
      // build after the response, so a stale durable cache can never turn into
      // a 14-second visitor wait. Mark both source labels stale so the UI does
      // not present an old snapshot as current while that rebuild runs.
      const feed = markStaleSnapshot(persisted.feed, persisted.fetchedAt);
      memoryCache = { at: now, feed };
      return {
        feed,
        meta: {
          source: 'durable',
          ageSeconds: feedAgeSeconds(feed, now),
          cacheAgeSeconds: wholeSeconds(cacheAgeMs),
          refreshRecommended: true,
        },
      };
    }
  }

  return buildRapidFeed(persisted);
}

async function buildRapidFeed(
  persisted: PersistedRapidFeed | null
): Promise<RapidFeedResult> {
  const now = new Date();
  const citiesPromise = getIceHeatmapSnapshot()
    .then((snapshot) => snapshot.cities)
    .catch((error): readonly CityPoint[] => {
      console.warn('Unable to load the Supabase ICE city reference snapshot', error);
      return [];
    });

  const [community, official] = await Promise.all([
    fetchCommunity(now, citiesPromise),
    fetchOfficial(now),
  ]);

  const communityFallback = community.alerts.length === 0 ? persisted : null;
  const officialFallback = official.releases.length === 0 ? persisted : null;

  const feed: RapidFeedBase = {
    generatedAt: now.toISOString(),
    community: communityFallback
      ? fallbackSource(
          community.source,
          communityFallback.feed.community,
          communityFallback.fetchedAt,
          'The community export could not be refreshed.'
        )
      : community.source,
    official: officialFallback
      ? fallbackSource(
          official.source,
          officialFallback.feed.official,
          officialFallback.fetchedAt,
          'The official ICE feed could not be refreshed.'
        )
      : official.source,
    alerts: communityFallback ? communityFallback.feed.alerts : community.alerts,
    officialReleases: officialFallback
      ? officialFallback.feed.officialReleases
      : official.releases,
  };

  if (hasUsableRapidFeed(feed)) {
    memoryCache = { at: Date.now(), feed };
  }

  // Only refresh the durable snapshot when the community source succeeded.
  // An official-only response must never overwrite a complete cached feed.
  if (community.alerts.length > 0) {
    await persistRapidFeed(feed);
  }

  return {
    feed,
    meta: {
      source: 'live',
      ageSeconds: feedAgeSeconds(feed, Date.now()),
      cacheAgeSeconds: 0,
      refreshRecommended: false,
    },
  };
}
