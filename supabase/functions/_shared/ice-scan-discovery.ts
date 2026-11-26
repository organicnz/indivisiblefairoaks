/**
 * Nationwide discovery providers for `ice-scan`.
 *
 * GDELT is the broad index, Bing News RSS adds the consumer-news surface, the
 * direct outlet feeds keep California and national coverage when an aggregator
 * is rate-limited, and public Mastodon tag timelines add the on-the-ground
 * posts that never reach a newsroom. Every provider is best-effort: one outage
 * never suppresses the others, and the same candidate discovered twice is
 * collapsed by canonical URL and normalized headline.
 *
 * A publisher that starts refusing its RSS endpoint is not retried every
 * fifteen minutes forever. The scan records a per-provider cooldown in the run
 * details, and while that feed is cooling down the publisher is covered by a
 * `site:`-scoped Bing News query instead. The cooldown is data rather than an
 * isolate-local cache, so a cold edge worker resumes the same schedule.
 */

import {
  BING_NEWS_ENDPOINT,
  DISCOVERY_MAX_RECORDS,
  NATIONWIDE_DISCOVERY_QUERY,
  buildBingNewsUrl,
  buildGdeltDiscoveryUrl,
  buildSiteScopedSearchQuery,
  dedupeCandidates,
  isBlockedProviderError,
  parseBingNewsPayload,
  parseGdeltArticles,
  parseMastodonPayload,
  parseNewsFeedPayload,
  parseSiteScopedBingPayload,
  providerCoolingDown,
  providerHealthAfterFailure,
  providerHealthAfterSuccess,
  regionalQueryForTick,
  shortError,
  withinDiscoveryWindow,
  type DiscoveryCandidate,
  type ProviderHealthMap,
} from './ice-scan-logic.ts';
import { fetchRawPage, mapWithConcurrency, sleep } from './ice-scan-http.ts';

const GDELT_QUERY_GAP_MS = 5_500;
const GDELT_TIMEOUT_MS = 20_000;
const FEED_TIMEOUT_MS = 12_000;
const BING_TIMEOUT_MS = 12_000;
const SITE_SEARCH_TIMEOUT_MS = 12_000;
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

type NewsFeed = {
  id: string;
  label: string;
  url: string;
  /** Present when a site-scoped Bing News query can cover a blocked feed. */
  domains?: readonly string[];
};

const NEWS_FEEDS: NewsFeed[] = [
  { id: 'npr', label: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml' },
  { id: 'fox-news', label: 'Fox News', url: 'https://moxie.foxnews.com/google-publisher/us.xml' },
  { id: 'nbc-news', label: 'NBC News', url: 'https://feeds.nbcnews.com/nbcnews/public/news' },
  { id: 'abc-news', label: 'ABC News', url: 'https://abcnews.go.com/abcnews/topstories' },
  { id: 'cbs-news', label: 'CBS News', url: 'https://www.cbsnews.com/latest/rss/main' },
  { id: 'guardian-us', label: 'The Guardian US', url: 'https://www.theguardian.com/us-news/rss' },
  {
    id: 'latimes',
    label: 'Los Angeles Times',
    url: 'https://www.latimes.com/california/rss2.0.xml',
    domains: ['latimes.com'],
  },
  { id: 'calmatters', label: 'CalMatters', url: 'https://calmatters.org/feed/', domains: ['calmatters.org'] },
  { id: 'pbs-newshour', label: 'PBS NewsHour', url: 'https://www.pbs.org/newshour/feeds/rss/politics' },
  {
    id: 'mercury-news',
    label: 'The Mercury News',
    url: 'https://www.mercurynews.com/feed/',
    domains: ['mercurynews.com'],
  },
  {
    id: 'oc-register',
    label: 'Orange County Register',
    url: 'https://www.ocregister.com/feed/',
    domains: ['ocregister.com'],
  },
  {
    id: 'sd-union-tribune',
    label: 'San Diego Union-Tribune',
    url: 'https://www.sandiegouniontribune.com/feed/',
    domains: ['sandiegouniontribune.com'],
  },
  {
    id: 'la-daily-news',
    label: 'Los Angeles Daily News',
    url: 'https://www.dailynews.com/feed/',
    domains: ['dailynews.com'],
  },
  {
    id: 'east-bay-times',
    label: 'East Bay Times',
    url: 'https://www.eastbaytimes.com/feed/',
    domains: ['eastbaytimes.com'],
  },
  {
    id: 'press-democrat',
    label: 'The Press Democrat',
    url: 'https://www.pressdemocrat.com/feed/',
    domains: ['pressdemocrat.com'],
  },
  {
    id: 'capradio',
    label: 'CapRadio',
    url: 'https://www.capradio.org/feed/',
    domains: ['capradio.org'],
  },
];

const MASTODON_INSTANCES = ['mastodon.social', 'hachyderm.io'] as const;
const MASTODON_TAGS = [
  'StopICE',
  'abolishICE',
  'immigrationdetention',
  'immigrationenforcement',
  'immigration',
] as const;

export type DiscoveryFallback = {
  feed: string;
  label: string;
  reason: string;
  found: number;
};

export type DiscoveryRun = {
  candidates: DiscoveryCandidate[];
  errors: string[];
  providers: string[];
  warnings: string[];
  fallbacks: DiscoveryFallback[];
  providerHealth: ProviderHealthMap;
};

type ProviderResult = {
  candidates: DiscoveryCandidate[];
  errors: string[];
  providers: string[];
  warnings: string[];
  fallbacks: DiscoveryFallback[];
};

const emptyResult = (): ProviderResult => ({
  candidates: [],
  errors: [],
  providers: [],
  warnings: [],
  fallbacks: [],
});

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

function failureKind(message: string) {
  return isBlockedProviderError(message) ? 'blocked' : 'transient';
}

function coolingMessage(
  label: string,
  state: { next_attempt_at: string | null } | undefined,
) {
  return `${label}: backing off until ${state?.next_attempt_at ?? 'unknown'}`;
}

async function discoverGdelt(
  deadline: number | undefined,
  providerHealth: ProviderHealthMap,
): Promise<ProviderResult> {
  const now = Date.now();
  const queries = [
    { key: 'gdelt:national', query: NATIONWIDE_DISCOVERY_QUERY },
    { key: 'gdelt:regional', query: regionalQueryForTick(now) },
  ];
  const candidates: DiscoveryCandidate[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let used = 0;
  let requested = 0;

  for (const entry of queries) {
    const state = providerHealth[entry.key];
    if (providerCoolingDown(state, now)) {
      warnings.push(coolingMessage(entry.key, state));
      continue;
    }
    if (deadline !== undefined && deadline - Date.now() < 8_000) {
      warnings.push(`${entry.key}: skipped because the discovery deadline is close`);
      break;
    }
    if (requested > 0) await sleep(GDELT_QUERY_GAP_MS);
    requested += 1;
    try {
      const body = await fetchText(buildGdeltDiscoveryUrl(entry.query), {
        timeoutMs: GDELT_TIMEOUT_MS,
        accept: 'application/json',
      });
      if (/please limit requests|too many requests/i.test(body.slice(0, 300))) {
        throw new Error('GDELT is rate-limiting this client.');
      }
      candidates.push(...parseGdeltArticles(body, entry.query));
      used += 1;
      providerHealth[entry.key] = providerHealthAfterSuccess(state, now);
    } catch (error) {
      const message = shortError(error);
      // GDELT's public text response is a rate-limit signal even when the
      // HTTP status is 200. A single 429 should not turn the whole scan red
      // when the direct feeds and Bing can still cover the state.
      const rateLimited = /please limit requests|too many requests|HTTP\s+429/i.test(message);
      providerHealth[entry.key] = providerHealthAfterFailure(
        state,
        message,
        now,
        rateLimited ? 'transient' : failureKind(message),
      );
      if (rateLimited) {
        warnings.push(`GDELT rate-limited ${entry.key}; provider backoff recorded`);
        break;
      }
      errors.push(`GDELT ${entry.key}: ${message}`);
    }
  }

  return {
    candidates,
    errors,
    warnings,
    providers: used > 0 ? ['gdelt-api'] : [],
    fallbacks: [],
  };
}

async function discoverBing(providerHealth: ProviderHealthMap): Promise<ProviderResult> {
  const key = 'bing-news';
  const now = Date.now();
  const state = providerHealth[key];
  if (providerCoolingDown(state, now)) {
    return {
      ...emptyResult(),
      warnings: [coolingMessage(key, state)],
    };
  }

  const results = await mapWithConcurrency(BING_QUERIES, 4, async (entry): Promise<ProviderResult> => {
    try {
      const body = await fetchText(buildBingNewsUrl(entry.query, entry.language), {
        timeoutMs: BING_TIMEOUT_MS,
        accept: 'application/rss+xml, application/xml, text/xml',
      });
      return {
        ...emptyResult(),
        candidates: parseBingNewsPayload(body, entry.query),
        providers: ['bing-news'],
      };
    } catch (error) {
      return {
        ...emptyResult(),
        errors: [`Bing News "${entry.query}": ${shortError(error)}`],
      };
    }
  });

  const errors = results.flatMap((result) => result.errors);
  const successful = results.some((result) => result.providers.includes('bing-news'));
  if (successful) {
    providerHealth[key] = providerHealthAfterSuccess(state, now);
  } else if (errors.length > 0) {
    providerHealth[key] = providerHealthAfterFailure(
      state,
      errors[0],
      now,
      failureKind(errors[0]),
    );
  }

  return {
    candidates: results.flatMap((result) => result.candidates),
    errors,
    providers: successful ? ['bing-news'] : [],
    warnings: [],
    fallbacks: [],
  };
}

async function siteSearchFallback(
  feed: NewsFeed,
  providerHealth: ProviderHealthMap,
  now: number,
): Promise<{ ok: true; candidates: DiscoveryCandidate[] } | { ok: false; error: string }> {
  if (!feed.domains?.length) return { ok: false, error: 'no site-scoped fallback configured' };

  // Site search is a Bing request too. If Bing itself is in cooldown, do not
  // turn seven publisher fallbacks into seven more requests against it.
  const bingState = providerHealth['bing-news'];
  if (providerCoolingDown(bingState, now)) {
    return { ok: false, error: coolingMessage('Bing News', bingState) };
  }

  const key = `site-search:${feed.id}`;
  const state = providerHealth[key];
  if (providerCoolingDown(state, now)) {
    return { ok: false, error: coolingMessage(`${feed.label} site search`, state) };
  }

  try {
    const query = buildSiteScopedSearchQuery(feed.domains[0]);
    const body = await fetchText(buildBingNewsUrl(query), {
      timeoutMs: SITE_SEARCH_TIMEOUT_MS,
      accept: 'application/rss+xml, application/xml, text/xml',
    });
    const candidates = parseSiteScopedBingPayload(
      body,
      { id: feed.id, label: feed.label, domains: feed.domains },
      query,
    );
    providerHealth[key] = providerHealthAfterSuccess(state, now);
    return { ok: true, candidates };
  } catch (error) {
    const message = shortError(error);
    providerHealth[key] = providerHealthAfterFailure(
      state,
      message,
      now,
      failureKind(message),
    );
    return { ok: false, error: message };
  }
}

async function discoverFeeds(providerHealth: ProviderHealthMap): Promise<ProviderResult> {
  const results = await mapWithConcurrency(NEWS_FEEDS, 5, async (feed): Promise<ProviderResult> => {
    const now = Date.now();
    const directKey = `rss:${feed.id}`;
    const directState = providerHealth[directKey];

    let directFailure: string | null = null;
    if (providerCoolingDown(directState, now)) {
      directFailure = coolingMessage(`${feed.label} RSS`, directState);
    } else {
      try {
        const body = await fetchText(feed.url, {
          timeoutMs: FEED_TIMEOUT_MS,
          maxBytes: 8_000_000,
          accept: 'application/rss+xml, application/xml, text/xml',
        });
        providerHealth[directKey] = providerHealthAfterSuccess(directState, now);
        return {
          candidates: parseNewsFeedPayload(body, feed),
          errors: [],
          providers: ['rss'],
          warnings: [],
          fallbacks: [],
        };
      } catch (error) {
        const message = shortError(error);
        providerHealth[directKey] = providerHealthAfterFailure(
          directState,
          message,
          now,
          failureKind(message),
        );
        directFailure = `${feed.label} RSS: ${message}`;
      }
    }

    const fallback = await siteSearchFallback(feed, providerHealth, now);
    if (fallback.ok) {
      return {
        candidates: fallback.candidates,
        errors: [],
        providers: ['site-search'],
        warnings: [`${feed.label}: ${directFailure}; site-scoped search covered the feed`],
        fallbacks: [
          {
            feed: feed.id,
            label: feed.label,
            reason: directFailure,
            found: fallback.candidates.length,
          },
        ],
      };
    }

    return {
      candidates: [],
      errors: [`${directFailure}; site search: ${fallback.error}`],
      providers: [],
      warnings: [],
      fallbacks: [],
    };
  });

  return {
    candidates: results.flatMap((result) => result.candidates),
    errors: results.flatMap((result) => result.errors),
    providers: [...new Set(results.flatMap((result) => result.providers))],
    warnings: results.flatMap((result) => result.warnings),
    fallbacks: results.flatMap((result) => result.fallbacks),
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
        ...emptyResult(),
        candidates: parseMastodonPayload(JSON.parse(body), entry.tag),
        providers: ['mastodon'],
      };
    } catch (error) {
      return {
        ...emptyResult(),
        errors: [`Mastodon ${entry.instance} #${entry.tag}: ${shortError(error)}`],
      };
    }
  });

  const successful = results.some((result) => result.providers.includes('mastodon'));
  return {
    candidates: results.flatMap((result) => result.candidates),
    errors: results.flatMap((result) => result.errors),
    providers: successful ? ['mastodon'] : [],
    warnings: [],
    fallbacks: [],
  };
}

/**
 * Run every public provider. The national and one rotating regional GDELT
 * query run sequentially because GDELT asks clients to keep five seconds
 * between requests; the independent providers run together. A provider
 * cooling down from a prior run is skipped rather than retried immediately.
 */
export async function discoverNationwideCandidates(
  options: { deadline?: number; providerHealth?: ProviderHealthMap } = {},
): Promise<DiscoveryRun> {
  const providerHealth: ProviderHealthMap = { ...(options.providerHealth ?? {}) };
  const [gdelt, bing, feeds, social] = await Promise.all([
    discoverGdelt(options.deadline, providerHealth),
    discoverBing(providerHealth),
    discoverFeeds(providerHealth),
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
    warnings: [...gdelt.warnings, ...bing.warnings, ...feeds.warnings, ...social.warnings].slice(
      0,
      40,
    ),
    fallbacks: feeds.fallbacks,
    providerHealth,
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
    fallbacks: run.fallbacks,
    warnings: run.warnings.slice(0, 20),
    errors: run.errors.slice(0, 20),
  };
}
