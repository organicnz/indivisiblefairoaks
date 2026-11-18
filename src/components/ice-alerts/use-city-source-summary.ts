'use client';

import { useEffect, useState } from 'react';
import type {
  IceSourceExtractionMethod,
  IceSourceReportKind,
} from '@/lib/ice-crawl-types';
import { fetchWithTimeout } from '@/lib/service-fetch';

const SUMMARY_CACHE_MS = 2 * 60 * 1000;
const SUMMARY_TIMEOUT_MS = 10_000;
const MAX_CACHE_ENTRIES = 40;

type CitySourceSummaryItem = {
  id: string;
  displayTitle: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  kind: IceSourceReportKind;
  extractionMethod: IceSourceExtractionMethod;
};

type CitySourceSummary = {
  city: string;
  stateCode: string;
  total: number;
  recent: CitySourceSummaryItem[];
};

type SummaryState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: CitySourceSummary | null;
};

const cache = new Map<string, { at: number; data: CitySourceSummary }>();

function cacheKey(city: string, stateCode: string) {
  return `${city.toLowerCase()}|${stateCode}`;
}

function isSummary(value: unknown): value is CitySourceSummary {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.city === 'string' &&
    typeof candidate.stateCode === 'string' &&
    typeof candidate.total === 'number' &&
    Number.isFinite(candidate.total) &&
    candidate.total >= 0 &&
    Array.isArray(candidate.recent) &&
    candidate.recent.every((item) => {
      if (typeof item !== 'object' || item === null) return false;
      const row = item as Record<string, unknown>;
      return (
        typeof row.id === 'string' &&
        typeof row.displayTitle === 'string' &&
        typeof row.sourceName === 'string' &&
        typeof row.sourceUrl === 'string' &&
        typeof row.publishedAt === 'string'
      );
    })
  );
}

/**
 * Read only the city-level source archive summary for the selected city. The
 * lookup is optional context, so a failed request is surfaced as unavailable
 * rather than replaced with an empty or invented archive.
 */
export function useCitySourceSummary(
  city: string | null,
  stateCode: string | null
): SummaryState {
  const [state, setState] = useState<SummaryState>({ status: 'idle', data: null });

  useEffect(() => {
    if (!city || !stateCode) {
      setState({ status: 'idle', data: null });
      return;
    }

    const key = cacheKey(city, stateCode);
    const cached = cache.get(key);
    const now = Date.now();
    if (cached && now - cached.at < SUMMARY_CACHE_MS) {
      setState({ status: 'ready', data: cached.data });
      return;
    }

    const controller = new AbortController();
    let active = true;
    setState({ status: 'loading', data: cached?.data ?? null });

    void (async () => {
      try {
        const params = new URLSearchParams({ city, state: stateCode });
        const response = await fetchWithTimeout(
          `/api/ice-source-reports/summary?${params.toString()}`,
          {
            cache: 'no-store',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          },
          SUMMARY_TIMEOUT_MS
        );

        if (!response.ok) throw new Error(`Source archive returned ${response.status}`);

        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          throw new Error('Source archive returned an unreadable response');
        }
        if (
          !isSummary(payload) ||
          payload.city.toLowerCase() !== city.toLowerCase() ||
          payload.stateCode !== stateCode
        ) {
          throw new Error('Source archive returned a different place');
        }

        if (cache.size >= MAX_CACHE_ENTRIES) {
          const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
          if (oldest) cache.delete(oldest[0]);
        }
        cache.set(key, { at: Date.now(), data: payload });
        if (active) setState({ status: 'ready', data: payload });
      } catch {
        if (!active || controller.signal.aborted) return;
        setState({ status: 'error', data: cached?.data ?? null });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [city, stateCode]);

  return state;
}
