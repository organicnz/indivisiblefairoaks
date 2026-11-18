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

export function useRapidFeed() {
  const [feed, setFeed] = useState<RapidFeed | null>(null);
  const [status, setStatus] = useState<RapidFeedRequestState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
          const nextFeed = { ...payload, publicCases: payload.publicCases ?? [] };
          feedRef.current = nextFeed;
          setFeed(nextFeed);
          setStatus('ready');
          setError(null);
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
    refresh: () => load(),
  };
}
