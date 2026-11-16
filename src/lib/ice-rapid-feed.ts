import type {
  OfficialRelease,
  RapidAlert,
  RapidAlertKind,
  RapidAlertStatus,
  RapidFeed,
  RapidFeedSource,
} from '@/components/ice-alerts/rapid-types';
import type { CityPoint } from '@/components/ice-alerts/types';
import { FUTURE_ALERT_TOLERANCE_MS } from '@/components/ice-alerts/rapid-alert-utils';
import { getIceHeatmapSnapshot } from '@/lib/queries/ice-heatmap';
import { createCityMatcher, extractStateCode } from './rapid-city-match';

const STOPICE_HOME = 'https://stopice.net/';
const STOPICE_DATA_INDEX = 'https://stopice.net/?data=1';
const STOPICE_SOURCE_NAME = 'Stop ICE Alerts Network';
const ICE_NEWSROOM_RSS = 'https://www.ice.gov/rss/ice-breaking-news';
const ICE_SOURCE_NAME = 'ICE Newsroom';
const ICE_SOURCE_URL = 'https://www.ice.gov/newsroom';
const FETCH_TIMEOUT_MS = 9_000;
const MAX_COMMUNITY_BYTES = 4_000_000;
const MAX_OFFICIAL_BYTES = 1_000_000;
const ACTIVE_WINDOW_MS = 4 * 60 * 60 * 1000;
/*
 * The export is nightly, but "current" should not survive a full day. Six
 * hours catches a missed or late overnight refresh without treating a
 * nearly day-old export as current. Delayed reports stay in the feed.
 */
const COMMUNITY_FRESH_MS = 6 * 60 * 60 * 1000;
const OFFICIAL_FRESH_MS = 14 * 24 * 60 * 60 * 1000;
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

let memoryCache: { at: number; feed: RapidFeed } | null = null;

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

async function fetchText(url: string, options: FetchOptions): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8',
        'User-Agent': 'IndivisibleFairOaks-ICERapidResponse/1.0 (+https://indivisiblefairoaks.org)',
      },
      next: { revalidate: options.revalidate },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Source returned ${response.status}`);

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > options.maxBytes) {
      throw new Error('Source payload is larger than the allowed limit');
    }

    const text = await response.text();
    if (text.length > options.maxBytes) {
      throw new Error('Source payload is larger than the allowed limit');
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
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

async function discoverCommunityFeedUrl(now: Date) {
  try {
    const index = await fetchText(STOPICE_DATA_INDEX, {
      revalidate: 900,
      maxBytes: 1_500_000,
    });
    const matches = [
      ...index.matchAll(
        /href=["']?([^"'\s>]*stopicenet_[a-z]{3}_\d{4}_complete\.xml)/gi
      ),
    ]
      .map((match) => match[1])
      .filter((path) => path.length < 300);

    for (const match of matches) {
      try {
        const candidate = new URL(match, STOPICE_HOME);
        if (
          candidate.protocol === 'https:' &&
          (candidate.hostname === 'stopice.net' || candidate.hostname === 'www.stopice.net')
        ) {
          return candidate.toString();
        }
      } catch {
        // Ignore malformed index links and keep looking.
      }
    }
  } catch (error) {
    console.warn('Unable to inspect the community data index', error);
  }

  for (const candidate of monthlyFileCandidates(now)) {
    try {
      await fetchText(candidate, { revalidate: 300, maxBytes: 4_000_000 });
      return candidate;
    } catch {
      // Try the previous month. A new month can be published late.
    }
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

async function fetchCommunity(now: Date, cities: readonly CityPoint[]) {
  try {
    if (cities.length === 0) {
      throw new Error('The Supabase ICE city reference snapshot is unavailable');
    }
    const url = await discoverCommunityFeedUrl(now);
    const xml = await fetchText(url, { revalidate: 300, maxBytes: MAX_COMMUNITY_BYTES });
    const parsed = parseStopIceCommunityFeed(xml, {
      cities,
      now,
      limit: 100,
      scanLimit: 600,
    });
    const latestAt = parsed.latestAt;
    const latestMs = latestAt ? Date.parse(latestAt) : Number.NaN;
    const age = Number.isFinite(latestMs)
      ? now.getTime() - latestMs
      : Number.POSITIVE_INFINITY;
    const stale = age > COMMUNITY_FRESH_MS;
    const note = stale
      ? `Delayed community export: the newest report is from ${
          Number.isFinite(latestMs) ? new Date(latestMs).toUTCString() : 'an unknown time'
        }. Older reports remain visible in the feed and on the map; they are not treated as active.`
      : 'Public nightly export. Locations are generalized to the nearest known city; raw details are withheld.';

    // Delayed only changes the label: keep the parsed alerts so older reports
    // remain available in the feed and map.
    return {
      alerts: parsed.alerts,
      source: sourceState(
        STOPICE_SOURCE_NAME,
        url,
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
 * Build the public feed. A source failure never turns into invented data; it is
 * reported as unavailable so the UI can be explicit about what is missing.
 */
export async function getRapidFeed(): Promise<RapidFeed> {
  if (memoryCache && Date.now() - memoryCache.at < 60_000) {
    return memoryCache.feed;
  }

  const now = new Date();
  let cities: readonly CityPoint[] = [];
  try {
    cities = (await getIceHeatmapSnapshot()).cities;
  } catch (error) {
    console.warn('Unable to load the Supabase ICE city reference snapshot', error);
  }

  const [community, official] = await Promise.all([
    fetchCommunity(now, cities),
    fetchOfficial(now),
  ]);

  const feed: RapidFeed = {
    generatedAt: now.toISOString(),
    community: community.source,
    official: official.source,
    alerts: community.alerts,
    officialReleases: official.releases,
  };

  memoryCache = { at: Date.now(), feed };
  return feed;
}
