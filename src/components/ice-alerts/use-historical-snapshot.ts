'use client';

import { useCallback, useState } from 'react';
import type { HeatmapSnapshot } from './types';

type LoadStatus = 'idle' | 'loading' | 'error';

let cachedSnapshot: HeatmapSnapshot | null = null;
let sharedRequest: Promise<HeatmapSnapshot | null> | null = null;

function isHeatmapSnapshot(value: unknown): value is HeatmapSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { cities?: unknown; meta?: unknown };
  return (
    Array.isArray(candidate.cities) &&
    typeof candidate.meta === 'object' &&
    candidate.meta !== null &&
    !Array.isArray(candidate.meta)
  );
}

function requestSnapshot(): Promise<HeatmapSnapshot | null> {
  if (sharedRequest) return sharedRequest;

  sharedRequest = fetch('/api/ice-heatmap', {
    headers: { accept: 'application/json' },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Historical heat-map request failed: ${response.status}`);
      }
      const payload: unknown = await response.json();
      if (!isHeatmapSnapshot(payload)) {
        throw new Error('Historical heat-map response was not a snapshot');
      }
      return payload;
    })
    .then((snapshot) => {
      cachedSnapshot = snapshot;
      return snapshot;
    })
    .catch(() => null)
    .finally(() => {
      sharedRequest = null;
    });

  return sharedRequest;
}

/**
 * The historical snapshot is large and is only needed by the FOIA overlay and
 * the historical map. Both consumers share one request and one in-memory copy.
 */
export function useHistoricalSnapshot() {
  const [snapshot, setSnapshot] = useState<HeatmapSnapshot | null>(cachedSnapshot);
  const [status, setStatus] = useState<LoadStatus>('idle');

  const load = useCallback(() => {
    if (cachedSnapshot) {
      setSnapshot(cachedSnapshot);
      setStatus('idle');
      return Promise.resolve(cachedSnapshot);
    }

    setStatus('loading');
    return requestSnapshot().then((result) => {
      if (result) {
        setSnapshot(result);
        setStatus('idle');
      } else {
        setStatus('error');
      }
      return result;
    });
  }, []);

  return { snapshot, status, load };
}
