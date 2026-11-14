'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDataPointsSnapshot } from '@/components/ui/DataPointsProvider';
import { dataPointGroup } from '@/lib/data-point-groups';
import { getDataPoints } from '@/lib/queries/civic-client';

const EMPTY_DATA_POINTS: Record<string, string> = {};

/**
 * A page can mount hundreds of DataPoints in one render. They all ask for the
 * same handful of groups, so share the request that is already in flight
 * instead of issuing one per component (and aborting most of them on nav).
 */
const inFlight = new Map<string, Promise<Record<string, string>>>();

function fetchGroup(group?: string): Promise<Record<string, string>> {
  const cacheKey = group ?? '';
  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const request = getDataPoints(group)
    .then((res) => res?.dataPoints ?? {})
    .catch(() => ({}))
    .finally(() => {
      if (inFlight.get(cacheKey) === request) inFlight.delete(cacheKey);
    });
  inFlight.set(cacheKey, request);
  return request;
}

/**
 * React hook to fetch and reactively sync data points from Supabase via Edge API functions.
 * The root layout supplies the whole table as a server snapshot, so the first
 * render already has database copy; the mount fetch keeps it fresh. The
 * snapshot wins over literal initialData, which only fills keys it lacks.
 * Listens for local visual-edit save events for real-time DOM synchronization.
 */
export function useDataPoints(group?: string, initialData: Record<string, string> = {}) {
  const snapshot = useDataPointsSnapshot();
  const [dataPoints, setDataPoints] = useState<Record<string, string>>(
    snapshot ? { ...initialData, ...snapshot } : initialData
  );
  const [loading, setLoading] = useState<boolean>(false);

  const fetchLive = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchGroup(group);
      if (Object.keys(res).length > 0) {
        setDataPoints((prev) => ({
          ...prev,
          ...res,
        }));
      }
    } catch {
      // Fallback cleanly to initialData without throwing
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    // Fetch live data points from Edge API route on client mount
    void fetchLive();

    const handleSaved = (e: Event) => {
      const customEvent = e as CustomEvent<{ key: string; value: string }>;
      if (customEvent.detail?.key) {
        const { key, value } = customEvent.detail;
        const normKeyGroup = dataPointGroup(key);
        const normHookGroup = dataPointGroup(group ?? '');
        if (
          !group ||
          key.startsWith(`${group}.`) ||
          (normHookGroup && normKeyGroup === normHookGroup)
        ) {
          setDataPoints((prev) => ({
            ...prev,
            [key]: value,
          }));
        }
      }
    };

    window.addEventListener('data-point-saved', handleSaved);
    return () => {
      window.removeEventListener('data-point-saved', handleSaved);
    };
  }, [group, fetchLive]);

  const get = useCallback(
    (key: string, fallback = ''): string => {
      return dataPoints[key] ?? fallback;
    },
    [dataPoints]
  );

  return { dataPoints, get, loading, refresh: fetchLive };
}
