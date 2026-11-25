/**
 * Nationwide discovery providers for `ice-scan`.
 *
 * GDELT is the broad index, Bing News RSS adds the consumer-news surface, the
 * direct outlet feeds keep California and national coverage when an aggregator
 * is rate-limited, and public Mastodon tag timelines add the on-the-ground
 * posts that never reach a newsroom. Every provider is best-effort: one outage
 * never suppresses the others, and the same candidate discovered twice is
 * collapsed by canonical URL and normalized headline.
 */

import {
  BING_NEWS_ENDPOINT,
  DISCOVERY_MAX_RECORDS,
  NATIONWIDE_DISCOVERY_QUERY,
  buildBingNewsUrl,
  buildGdeltDiscoveryUrl,
  dedupeCandidates,
  parseBingNewsPayload,
  parseGdeltArticles,
  parseMastodonPayload,
  parseNewsFeedPayload,
  regionalQueryForTick,
  shortError,
  withinDiscoveryWindow,
  type DiscoveryCandidate,
} from './ice-scan-logic.ts';
import { fetchRawPage, mapWithConcurrency, sleep } from './ice-scan-http.ts';

const GDELT_QUERY_GAP_MS = 5_500;
const GDELT_TIMEOUT_MS = 20_000;
const FEED_TIMEOUT_MS = 12_000;
const BING_TIMEOUT_MS = 12_000;
const SOCIAL_TIMEOUT_MS = 10_000;

type BingQuery = { query: string; language?: string };

const BING_QUERIES: BingQuery[] = [
  { query: 'ICE raid' },
  { query: 'ICE arrests' },
  { query: 'ICE detention' },
  { query: 'ICE checkpoint' },
  { query: 'immigration raid' },
  { query: '287(g)' },
  { query: '"ICE agents" California' },
  { query: 'redadas de ICE', language: 'es-US' },
  { query: 'arrestos de ICE', language: 'es-US' },
  { query: 'detención migratoria', language: 'es-US' },
];

type NewsFeed = { id: string; label: string; url: string };

const NEWS_FEEDS: NewsFeed[] = [
  { id: 'npr', label: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml' },
  { id: 'fox-news', label: 'Fox News', url: 'https://moxie.foxnews.com/google-publisher/us.xml' },
  { id: 'nbc-news', label: 'NBC News', url: 'https://feeds.nbcnews.com/nbcnews/public/news' },
  { id: 'abc-news', label: 'ABC News', url: 'https://abcnews.go.com/abcnews/topstories' },
  { id: 'cbs-news', label: 'CBS News', url: 'https://www.cbsnews.com/latest/rss/main' },
  { id: 'guardian-us', label: 'The Guardian US', url: 'https://www.theguardian.com/us-news/rss' },
  { id: 'latimes', label: 'Los Angeles Times', url: 'https://www.latimes.com/california/rss2.0.xml' },
  { id: 'calmatters', label: 'CalMatters', url: 'https://calmatters.org/feed/' },
  { id: 'pbs-newshour', label: 'PBS NewsHour', url: 'https://www.pbs.org/newshour/feeds/rss/politics' },
  { id: 'mercury-news', label: 'The Mercury News', url: 'https://www.mercurynews.com/feed/' },
  { id: 'oc-register', label: 'Orange County Register', url: 'https://www.ocregister.com/feed/' },
  {
    id: 'sd-union-tribune',
    label: 'San Diego Union-Tribune',
    url: 'https://www.sandiegouniontribune.com/feed/',
  },
  { id: 'la-daily-news', label: 'Los Angeles Daily News', url: 'https://www.dailynews.com/feed/' },
  { id: 'east-bay-times', label: 'East Bay Times', url: 'https://www.eastbaytimes.com/feed/' },
  { id: 'press-democrat', label: 'The Press Democrat', url: 'https://www.pressdemocrat.com/feed/' },
  { id: 'capradio', label: 'CapRadio', url: 'https://www.capradio.org/feed/' },
];

const MASTODON_INSTANCES = ['mastodon.social', 'hachyderm.io'] as const;
const MASTODON_TAGS = [
  'StopICE',
  'abolishICE',
  'immigrationdetention',
  'immigrationenforcement',
  'immigration',
] as const;

export type DiscoveryRun = {
  candidates: DiscoveryCandidate[];
  errors: string[];
  providers: string[];
};

type ProviderResult = {
  candidates: DiscoveryCandidate[];
  errors: string[];
  providers: string[];
};

async function fetchText(
  url: string,
  options: { timeoutMs: number; maxBytes?: number; accept?: string },
) {
  const response = await fetchRawPage(url, {
    timeoutMs: options.timeoutMs,
    maxBytes: options.maxBytes ?? 6_000_000,
    accept:
      options.accept ?? 'application/rss+xml, application/xml, text/xml, application/json;q=0.9, */*;q=0.5',
  });
  return response.text;
}

async function discoverGdelt(deadline?: number): Promise<ProviderResult> {
  const now = Date.now();
  const queries = [NATIONWIDE_DISCOVERY_QUERY, regionalQueryForTick(now)];
  const candidates: DiscoveryCandidate[] = [];
  const errors: string[] = [];
  let used = 0;

  for (const [index, query] of queries.entries()) {
    if (deadline !== undefined && deadline - Date.now() < 8_000) break;
    if (index > 0) await sleep(GDELT_QUERY_GAP_MS);
    try {
      const body = await fetchText(buildGdeltDiscoveryUrl(query), {
        timeoutMs: GDELT_TIMEOUT_MS,
        accept: 'application/json',
      });
      if (/please limit requests|too many requests/i.test(body.slice(0, 300))) {
        throw new Error('GDELT is rate-limiting this client.');
      }
      candidates.push(...parseGdeltArticles(body, query));
      used += 1;
    } catch (error) {
      errors.push(`GDELT: ${shortError(error)}`);
    }
  }

  return {
    candidates,
    errors,
    providers: used > 0 ? ['gdelt-api'] : [],
  };
}

async function discoverBing(): Promise<ProviderResult> {
  const results = await mapWithConcurrency(BING_QUERIES, 4, async (entry): Promise<ProviderResult> => {
    try {
      const body = await fetchText(buildBingNewsUrl(entry.query, entry.language), {
        timeoutMs: BING_TIMEOUT_MS,
        accept: 'application/rss+xml, application/xml, text/xml',
      });
      return {
        candidates: parseBingNewsPayload(body, entry.query),
        errors: [],
        providers: ['bing-news'],
      };
    } catch (error) {
      return {
        candidates: [],
        errors: [`Bing News "${entry.query}": ${shortError(error)}`],
        providers: [],
      };
    }
  });

  return {
    candidates: results.flatMap((result) => result.candidates),
    errors: results.flatMap((result) => result.errors),
    providers: ['bing-news'],
  };
}

async function discoverFeeds(): Promise<ProviderResult> {
  const results = await mapWithConcurrency(NEWS_FEEDS, 5, async (feed): Promise<ProviderResult> => {
    try {
      const body = await fetchText(feed.url, {
        timeoutMs: FEED_TIMEOUT_MS,
        maxBytes: 8_000_000,
        accept: 'application/rss+xml, application/xml, text/xml',
      });
      return {
        candidates: parseNewsFeedPayload(body, feed),
        errors: [],
        providers: ['rss'],
      };
    } catch (error) {
      return {
        candidates: [],
        errors: [`${feed.label} RSS: ${shortError(error)}`],
        providers: [],
      };
    }
  });

  return {
    candidates: results.flatMap((result) => result.candidates),
    errors: results.flatMap((result) => result.errors),
    providers: ['rss'],
  };
}

async function discoverMastodon(): Promise<ProviderResult> {
  const requests = MASTODON_INSTANCES.flatMap((instance) =>
    MASTODON_TAGS.map((tag) => ({ instance, tag })),
  );
  const results = await mapWithConcurrency(requests, 5, async (entry): Promise<ProviderResult> => {
    const url = `https://${entry.instance}/api/v1/timelines/tag/${encodeURIComponent(entry.tag)}?limit=40`;
    try {
      const body = await fetchText(url, {
        timeoutMs: SOCIAL_TIMEOUT_MS,
        maxBytes: 2_000_000,
        accept: 'application/json',
      });
      return {
        candidates: parseMastodonPayload(JSON.parse(body), entry.tag),
        errors: [],
        providers: ['mastodon'],
      };
    } catch (error) {
      return {
        candidates: [],
        errors: [`Mastodon ${entry.instance} #${entry.tag}: ${shortError(error)}`],
        providers: [],
      };
    }
  });

  return {
    candidates: results.flatMap((result) => result.candidates),
    errors: results.flatMap((result) => result.errors),
    providers: ['mastodon'],
  };
}

/**
 * Run every public provider. The national and one rotating regional GDELT
 * query run sequentially because GDELT asks clients to keep five seconds
 * between requests; the independent providers run together.
 */
export async function discoverNationwideCandidates(
  options: { deadline?: number } = {},
): Promise<DiscoveryRun> {
  const [gdelt, bing, feeds, social] = await Promise.all([
    discoverGdelt(options.deadline),
    discoverBing(),
    discoverFeeds(),
    discoverMastodon(),
  ]);

  const now = Date.now();
  const merged = dedupeCandidates([
    ...gdelt.candidates,
    ...bing.candidates,
    ...feeds.candidates,
    ...social.candidates,
  ])
    .filter((candidate) => withinDiscoveryWindow(candidate, now))
    .slice(0, DISCOVERY_MAX_RECORDS);

  return {
    candidates: merged,
    errors: [...gdelt.errors, ...bing.errors, ...feeds.errors, ...social.errors].slice(0, 40),
    providers: [
      ...new Set([...gdelt.providers, ...bing.providers, ...feeds.providers, ...social.providers]),
    ],
  };
}

/** Exported for a focused provider test; not used by the scheduled path. */
export const discoverySources = {
  bing: BING_QUERIES,
  feeds: NEWS_FEEDS,
  mastodonInstances: MASTODON_INSTANCES,
  mastodonTags: MASTODON_TAGS,
  endpoint: BING_NEWS_ENDPOINT,
};

/** A compact status line for the run row, without page text or credentials. */
export function discoveryDetails(run: DiscoveryRun) {
  return {
    providers: run.providers,
    candidates: run.candidates.length,
    errors: run.errors.slice(0, 20),
  };
}
