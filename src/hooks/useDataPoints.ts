'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDataPointsSnapshot } from '@/components/ui/DataPointsProvider';
import { dataPointGroup } from '@/lib/data-point-groups';
import { getDataPoints } from '@/lib/queries/civic-client';

const EMPTY_DATA_POINTS: Record<string, string> = {};

/**
 * Whether a server-supplied record already covers this group. Any key in the
 * group is enough: the root layout sends whole groups, and a page's
 * `initialData` is the complete group its server query read. Checking this
 * before mounting avoids a second request for copy that is already in the
 * HTML/RSC payload.
 */
function hasGroup(source: Record<string, string>, group?: string): boolean {
  if (!group) return false;
  const normalized = dataPointGroup(group);
  for (const key of Object.keys(source)) {
    if (dataPointGroup(key) === normalized) return true;
  }
  return false;
}

/**
 * A page can mount hundreds of DataPoints in one render. They all ask for the
 * same handful of groups, so share the request that is already in flight
 * instead of issuing one per component (and aborting most of them on nav).
 */
const inFlight = new Map<string, Promise<Record<string, string>>>();

/**
 * One window listener for every mounted data point.
 *
 * A page can render hundreds of `DataPoint`s, and each one used to install its
 * own `data-point-saved` listener. That made a save dispatch through hundreds
 * of DOM listeners even though only one group usually changes. The listener is
 * now installed once, lazily, and fans out to the mounted hooks; the DOM cost
 * is constant regardless of how much copy is on the page.
 */
type SavedDataPointHandler = (key: string, value: string) => void;
const savedDataPointHandlers = new Set<SavedDataPointHandler>();
let savedDataPointListenerInstalled = false;

function subscribeToSavedDataPoints(handler: SavedDataPointHandler): () => void {
  savedDataPointHandlers.add(handler);

  if (!savedDataPointListenerInstalled && typeof window !== 'undefined') {
    savedDataPointListenerInstalled = true;
    window.addEventListener('data-point-saved', (event) => {
      const detail = (event as CustomEvent<{ key?: string; value?: string }>).detail;
      if (!detail?.key) return;
      for (const mountedHandler of savedDataPointHandlers) {
        mountedHandler(detail.key, detail.value ?? '');
      }
    });
  }

  return () => {
    savedDataPointHandlers.delete(handler);
  };
}

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
  // The server snapshot and a page's initialData are authoritative for the
  // first render. Fetching the same group again on mount was one API request
  // per group per page view, for copy that had just been server-rendered. An
  // editor save still reaches every mounted DataPoint through the
  // `data-point-saved` event below.
  const seeded = hasGroup(snapshot ?? EMPTY_DATA_POINTS, group) || hasGroup(initialData, group);

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
    // Fetch only when the server did not already supply this group.
    if (!seeded) void fetchLive();

    return subscribeToSavedDataPoints((key, value) => {
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
    });
  }, [group, fetchLive, seeded]);

  const get = useCallback(
    (key: string, fallback = ''): string => {
      return dataPoints[key] ?? fallback;
    },
    [dataPoints]
  );

  return { dataPoints, get, loading, refresh: fetchLive };
}
