'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { isUsPoint } from '@/lib/geo/us-boundary';
import { APPROXIMATE_TIMEOUT_MS, GEO_ENDPOINT, GEOLOCATION_TIMEOUT_MS } from './constants';
import type { ApproximateGeoResponse, UserLocation, UserLocationStatus } from './types';

function isApproximateGeoResponse(value: unknown): value is ApproximateGeoResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.available === true) {
    return (
      typeof candidate.lat === 'number' &&
      Number.isFinite(candidate.lat) &&
      typeof candidate.lng === 'number' &&
      Number.isFinite(candidate.lng) &&
      typeof candidate.label === 'string'
    );
  }
  return candidate.available === false;
}

type UseUserLocationOptions = {
  shouldFocusUser?: RefObject<boolean>;
};

/**
 * Approximate (edge IP) and precise (browser) location for the city circle map.
 *
 * The map starts nationwide and never blocks on this: a slow edge function is
 * aborted after `APPROXIMATE_TIMEOUT_MS` so the national view stays usable.
 */
export function useUserLocation({ shouldFocusUser }: UseUserLocationOptions) {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [userLocationStatus, setUserLocationStatus] = useState<UserLocationStatus>('checking');
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  const userLocationRef = useRef<UserLocation | null>(null);
  const precisePendingRef = useRef(false);

  const applyUserLocation = useCallback((next: UserLocation) => {
    userLocationRef.current = next;
    setUserLocation(next);
    setUserLocationStatus('available');
  }, []);

  const requestPrecise = useCallback(() => {
    if (!('geolocation' in navigator)) {
      const existing = userLocationRef.current;
      setUserLocationStatus(existing ? 'available' : 'unavailable');
      setLocationNotice(
        existing ? null : 'Device location is unavailable. Showing the U.S. overview.'
      );
      return;
    }

    precisePendingRef.current = true;
    setUserLocationStatus('locating');
    setLocationNotice(null);
    if (shouldFocusUser) shouldFocusUser.current = true;

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          precisePendingRef.current = false;
          const { latitude, longitude } = position.coords;
          if (!isUsPoint(latitude, longitude)) {
            setUserLocationStatus(userLocationRef.current ? 'available' : 'unavailable');
            setLocationNotice(
              'Your device location appears outside the U.S. Showing the full U.S. map.'
            );
            return;
          }

          applyUserLocation({
            lat: latitude,
            lng: longitude,
            label: 'your current location',
            precision: 'precise',
          });
          setLocationNotice(null);
        },
        (error) => {
          precisePendingRef.current = false;
          const existing = userLocationRef.current;
          setUserLocationStatus(existing ? 'available' : 'unavailable');
          setLocationNotice(
            existing
              ? null
              : error.code === 3
                ? 'Device location timed out. Showing the U.S. overview.'
                : 'Device location is unavailable. Showing the U.S. overview.'
          );
        },
        {
          enableHighAccuracy: true,
          maximumAge: 60_000,
          timeout: GEOLOCATION_TIMEOUT_MS,
        }
      );
    } catch {
      precisePendingRef.current = false;
      const existing = userLocationRef.current;
      setUserLocationStatus(existing ? 'available' : 'unavailable');
      setLocationNotice(
        existing ? null : 'Device location is unavailable. Showing the U.S. overview.'
      );
    }
  }, [applyUserLocation, shouldFocusUser]);

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    // Do not let a slow edge function hold the location card in its checking
    // state; the national view and the approximate fallback remain usable.
    const timeout = window.setTimeout(() => controller.abort(), APPROXIMATE_TIMEOUT_MS);

    void (async () => {
      let approximate: UserLocation | null = null;

      try {
        const response = await fetch(GEO_ENDPOINT, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Approximate location returned ${response.status}`);

        const payload: unknown = await response.json();
        if (disposed) return;

        if (isApproximateGeoResponse(payload) && payload.available) {
          approximate = {
            lat: payload.lat,
            lng: payload.lng,
            label: payload.label || 'your area',
            precision: 'approximate',
          };
        }
      } catch {
        // The national view is the fallback; no error needs to surface here.
      }

      if (disposed) return;

      if (approximate && userLocationRef.current?.precision !== 'precise') {
        userLocationRef.current = approximate;
        setUserLocation(approximate);
        if (!precisePendingRef.current) setUserLocationStatus('available');
      } else if (!approximate && !userLocationRef.current) {
        if (!precisePendingRef.current) setUserLocationStatus('unavailable');
      }

      try {
        const permission = await navigator.permissions?.query({
          name: 'geolocation' as PermissionName,
        });
        if (disposed) return;

        // Precise location is an upgrade only: if permission is already
        // granted, use it automatically. Prompting and denial never replace
        // the approximate area that has already loaded.
        if (permission?.state === 'granted') {
          requestPrecise();
        }
      } catch {
        // Permissions API support varies; the approximate area remains usable.
      }
    })();

    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [requestPrecise]);

  return {
    userLocation,
    userLocationRef,
    userLocationStatus,
    locationNotice,
    requestPrecise,
  };
}
