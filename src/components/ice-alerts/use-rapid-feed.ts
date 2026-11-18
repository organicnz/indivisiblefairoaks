'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWithTimeout, ServiceTimeoutError } from '@/lib/service-fetch';
import type { RapidFeed, RapidFeedRequestState } from './rapid-types';

const FEED_ENDPOINT = '/api/ice-rapid';
const REFRESH_INTERVAL_MS = 2 * 60 * 1000;
// The route has a 25s server deadline. Keep the browser deadline above it so a
// slow route response is not aborted just before it can return; a 504 is then
// retried using the normal failure policy instead of surfacing as a timeout.
const FEED_TIMEOUT_MS = 30_000;
const RETRY_DELAYS_MS = [750, 2_000] as const;
const FEED_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const RAPID_FEED_CACHE_KEY = 'ice-rapid-feed-v1';

export type RapidFeedCacheState = {
  fromCache: boolean;
  cachedAt: number | null;
};

type CachedRapidFeed = {
  version: 1;
  cachedAt: number;
  feed: RapidFeed;
};

class FeedHttpError extends Error {
  constructor(readonly status: number) {
    super(status === 503 ? 'Feed snapshot is temporarily unavailable' : `Feed returned ${status}`);
    this.name = 'FeedHttpError';
  }
}

class FeedPayloadError extends Error {
  constructor() {
    super('Feed response was not valid');
    this.name = 'FeedPayloadError';
  }
}

function retryable(caught: unknown): boolean {
  if (caught instanceof ServiceTimeoutError) return false;
  if (caught instanceof FeedPayloadError) return true;
  if (caught instanceof FeedHttpError) {
    return caught.status === 429 || caught.status >= 500;
  }
  return caught instanceof TypeError;
}

function errorMessage(caught: unknown): string {
  if (caught instanceof ServiceTimeoutError) {
    return 'The rapid-response feed took too long to load. It will retry automatically.';
  }
  if (caught instanceof FeedHttpError && caught.status === 503) {
    return 'The rapid-response feed is between snapshots. It will retry automatically.';
  }
  if (caught instanceof TypeError) {
    return 'The rapid-response feed could not be reached. It will retry automatically.';
  }
  if (caught instanceof FeedPayloadError) {
    return 'The rapid-response feed returned an unreadable snapshot. It will retry automatically.';
  }
  return caught instanceof Error && caught.message
    ? caught.message
    : 'The rapid-response feed is temporarily unavailable.';
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRapidFeed(value: unknown): value is RapidFeed {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.generatedAt === 'string' &&
    Array.isArray(candidate.alerts) &&
    Array.isArray(candidate.officialReleases) &&
    (candidate.publicCases === undefined || Array.isArray(candidate.publicCases)) &&
    typeof candidate.community === 'object' &&
    candidate.community !== null &&
    typeof candidate.official === 'object' &&
    candidate.official !== null
  );
}

function normalizeFeed(payload: RapidFeed): RapidFeed {
  return { ...payload, publicCases: payload.publicCases ?? [] };
}

function readCachedFeed(): { feed: RapidFeed; cachedAt: number } | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(RAPID_FEED_CACHE_KEY);
    if (!raw) return null;

    const candidate = JSON.parse(raw) as Partial<CachedRapidFeed>;
    if (
      candidate.version !== 1 ||
      typeof candidate.cachedAt !== 'number' ||
      !Number.isFinite(candidate.cachedAt) ||
      candidate.cachedAt <= 0 ||
      !isRapidFeed(candidate.feed)
    ) {
      window.localStorage.removeItem(RAPID_FEED_CACHE_KEY);
      return null;
    }

    if (Date.now() - candidate.cachedAt > FEED_CACHE_MAX_AGE_MS) {
      window.localStorage.removeItem(RAPID_FEED_CACHE_KEY);
      return null;
    }

    return { feed: normalizeFeed(candidate.feed), cachedAt: candidate.cachedAt };
  } catch {
    return null;
  }
}

function writeCachedFeed(feed: RapidFeed) {
  if (typeof window === 'undefined') return;

  try {
    const cached: CachedRapidFeed = { version: 1, cachedAt: Date.now(), feed };
    window.localStorage.setItem(RAPID_FEED_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Storage can be unavailable in private modes or full quotas. The live
    // snapshot remains usable; only the offline fallback is unavailable.
  }
}

export function useRapidFeed() {
  const [feed, setFeed] = useState<RapidFeed | null>(null);
  const [status, setStatus] = useState<RapidFeedRequestState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cache, setCache] = useState<RapidFeedCacheState>({
    fromCache: false,
    cachedAt: null,
  });
  const activeRequestRef = useRef<AbortController | null>(null);
  const feedRef = useRef<RapidFeed | null>(null);

  const load = useCallback(async (options: { silent?: boolean } = {}) => {
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    if (!options.silent) setIsRefreshing(true);

    try {
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
        try {
          const response = await fetchWithTimeout(FEED_ENDPOINT, {
            cache: 'no-store',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          }, FEED_TIMEOUT_MS);
          if (!response.ok) throw new FeedHttpError(response.status);

          let payload: unknown;
          try {
            payload = await response.json();
          } catch {
            throw new FeedPayloadError();
          }
          if (!isRapidFeed(payload)) throw new FeedPayloadError();

          // A feed cached before the community-case field was added is still a
          // valid feed; normalize it rather than blanking the map during deploy.
          const nextFeed = normalizeFeed(payload);
          feedRef.current = nextFeed;
          setFeed(nextFeed);
          setStatus('ready');
          setError(null);
          setCache({ fromCache: false, cachedAt: null });
          writeCachedFeed(nextFeed);
          return;
        } catch (caught) {
          if (controller.signal.aborted) return;
          const delay = RETRY_DELAYS_MS[attempt];
          if (delay !== undefined && retryable(caught)) {
            await wait(delay);
            if (controller.signal.aborted) return;
            continue;
          }
          throw caught;
        }
      }
    } catch (caught) {
      if (controller.signal.aborted) return;

      // A failed background refresh must never replace a usable feed with an
      // error state. Keep the last successful snapshot mounted and surface the
      // failure as a non-destructive notice above it.
      const hasLastGoodFeed = feedRef.current !== null;
      setStatus(hasLastGoodFeed ? 'ready' : 'error');
      setError(errorMessage(caught));
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const cached = readCachedFeed();
    if (!cached || feedRef.current) return;

    feedRef.current = cached.feed;
    setFeed(cached.feed);
    setStatus('ready');
    setCache({ fromCache: true, cachedAt: cached.cachedAt });
  }, []);

  useEffect(() => {
    void load();

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load({ silent: true });
    }, REFRESH_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void load({ silent: true });
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      activeRequestRef.current?.abort();
    };
  }, [load]);

  return {
    feed,
    status,
    error,
    isRefreshing,
    cache,
    refresh: () => load(),
  };
}
