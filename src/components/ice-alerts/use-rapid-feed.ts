'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWithTimeout, ServiceTimeoutError } from '@/lib/service-fetch';
import type { RapidFeed, RapidFeedRequestState } from './rapid-types';

const FEED_ENDPOINT = '/api/ice-rapid';
const REFRESH_INTERVAL_MS = 2 * 60 * 1000;
// The route aggregates a nightly community export plus the ICE newsroom feed
// and can take longer than the default 8s service budget on a cold cache.
const FEED_TIMEOUT_MS = 25_000;
const RETRY_DELAYS_MS = [750, 2_000] as const;

class FeedHttpError extends Error {
  constructor(readonly status: number) {
    super(status === 503 ? 'Feed snapshot is temporarily unavailable' : `Feed returned ${status}`);
    this.name = 'FeedHttpError';
  }
}

function retryable(caught: unknown): boolean {
  if (caught instanceof ServiceTimeoutError) return false;
  if (caught instanceof FeedHttpError) {
    return caught.status === 429 || caught.status >= 500;
  }
  return caught instanceof TypeError;
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

          const payload: unknown = await response.json();
          if (!isRapidFeed(payload)) throw new Error('Feed response was not valid');

          // A feed cached before the community-case field was added is still a
          // valid feed; normalize it rather than blanking the map during deploy.
          setFeed({ ...payload, publicCases: payload.publicCases ?? [] });
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
      setStatus('error');
      setError(
        caught instanceof ServiceTimeoutError
          ? 'The rapid-response feed took too long to load. It will retry automatically.'
          : caught instanceof FeedHttpError && caught.status === 503
          ? 'The rapid-response feed is between snapshots. It will retry automatically.'
          : caught instanceof Error && caught.message
          ? caught.message
          : 'The rapid-response feed is temporarily unavailable.'
      );
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
