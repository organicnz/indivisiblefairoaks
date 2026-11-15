'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CityPoint } from './types';

export type IceCaseImage = {
  url: string;
  alt: string;
  credit: string;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
  kind: 'place-reference';
};

export type IceCaseBriefData = {
  headline: string;
  brief: string;
  caveats: string[];
  generatedAt: string;
  generatedBy: 'ai' | 'dataset';
  image: IceCaseImage | null;
  imageNotice: string;
  city: {
    city: string;
    state: string;
    stateCode: string;
    count: number;
    rank: number;
    sharePercent: number;
  };
  source: {
    name: string;
    url: string;
    release: string;
    citation: string;
    periodStart: string;
    periodEnd: string;
  };
};

export type IceCaseBriefState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: IceCaseBriefData }
  | { status: 'error'; message: string };

const CACHE_TTL_MS = 60 * 60 * 1_000;
const CACHE_LIMIT = 180;
const REQUEST_TIMEOUT_MS = 32_000;
const briefCache = new Map<string, { data: IceCaseBriefData; expiresAt: number }>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isImage(value: unknown): value is IceCaseImage {
  if (!isRecord(value)) return false;
  return (
    typeof value.url === 'string' &&
    value.url.startsWith('https://') &&
    typeof value.alt === 'string' &&
    typeof value.credit === 'string' &&
    typeof value.license === 'string' &&
    (value.licenseUrl === null || typeof value.licenseUrl === 'string') &&
    typeof value.sourceUrl === 'string' &&
    value.kind === 'place-reference'
  );
}

function isBriefData(value: unknown): value is IceCaseBriefData {
  if (!isRecord(value)) return false;
  if (typeof value.headline !== 'string' || typeof value.brief !== 'string') return false;
  if (!isStringArray(value.caveats) || value.caveats.length < 1) return false;
  if (typeof value.generatedAt !== 'string') return false;
  if (value.generatedBy !== 'ai' && value.generatedBy !== 'dataset') return false;
  if (value.image !== null && !isImage(value.image)) return false;
  if (typeof value.imageNotice !== 'string') return false;
  if (!isRecord(value.city) || !isRecord(value.source)) return false;
  if (typeof value.source.url !== 'string' || !value.source.url.startsWith('https://')) {
    return false;
  }
  return true;
}

function cacheBrief(key: string, data: IceCaseBriefData): void {
  briefCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  if (briefCache.size <= CACHE_LIMIT) return;
  const oldest = briefCache.keys().next().value;
  if (oldest) briefCache.delete(oldest);
}

function errorMessage(status: number): string {
  if (status === 429) return 'Too many requests. Please try again in a few minutes.';
  return 'AI context is temporarily unavailable.';
}

export function useIceCaseBrief(city: CityPoint | null) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<IceCaseBriefState>({ status: 'idle' });

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!city) {
      setState({ status: 'idle' });
      return;
    }

    const key = `${city.city}|${city.stateCode}`;
    const cached = briefCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      setState({ status: 'ready', data: cached.data });
      return;
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    setState({ status: 'loading' });

    void fetch('/api/ice-case', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ city: city.city, stateCode: city.stateCode }),
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(errorMessage(response.status));
        const json: unknown = await response.json();
        if (!isBriefData(json)) throw new Error('AI context returned an unexpected response.');
        cacheBrief(key, json);
        if (!controller.signal.aborted) setState({ status: 'ready', data: json });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted && !timedOut) return;
        setState({
          status: 'error',
          message: timedOut
            ? 'AI context took too long to load.'
            : error instanceof Error
              ? error.message
              : 'AI context is temporarily unavailable.',
        });
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [city, attempt]);

  return { state, retry };
}
