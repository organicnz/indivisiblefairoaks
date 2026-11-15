'use client';

import type { Map as LeafletMap } from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import type { Dispatch, FormEvent, RefObject, SetStateAction } from 'react';
import { isUsPoint } from '@/lib/geo/us-boundary';
import { LOCATION_CACHE_LIMIT, LOCATION_SEARCH_ZOOM, NOMINATIM_SEARCH_URL } from './constants';
import type {
  CityPoint,
  LocationSearchState,
  MapView,
  NominatimResult,
  SearchTarget,
} from './types';

type UseLocationSearchOptions = {
  mapRef: RefObject<LeafletMap | null>;
  searchTarget: SearchTarget | null;
  setMapView: Dispatch<SetStateAction<MapView>>;
  setSelectedCity: Dispatch<SetStateAction<CityPoint | null>>;
  setSearchTarget: Dispatch<SetStateAction<SearchTarget | null>>;
  shouldFocusUser: RefObject<boolean>;
};

/**
 * Place-name search against Nominatim, constrained to the U.S.
 *
 * Nominatim's public policy requires caching, so results (including "no
 * result") are kept in a small LRU. The search only moves the map; it never
 * changes the snapshot.
 */
export function useLocationSearch({
  mapRef,
  searchTarget,
  setMapView,
  setSelectedCity,
  setSearchTarget,
  shouldFocusUser,
}: UseLocationSearchOptions) {
  const [locationInput, setLocationInput] = useState('');
  const [locationSearch, setLocationSearch] = useState<LocationSearchState>({ kind: 'idle' });
  const locationAbortRef = useRef<AbortController | null>(null);
  const locationCacheRef = useRef<Map<string, SearchTarget | null>>(new Map());

  useEffect(() => () => locationAbortRef.current?.abort(), []);

  const abortLocationSearch = () => {
    locationAbortRef.current?.abort();
    locationAbortRef.current = null;
  };

  const clearLocationSearch = () => {
    abortLocationSearch();
    setSearchTarget(null);
    setLocationSearch({ kind: 'idle' });
  };

  const handleLocationInputChange = (value: string) => {
    setLocationInput(value);
    if (searchTarget) {
      setSearchTarget(null);
    }
    if (locationSearch.kind === 'searching') {
      abortLocationSearch();
    }
    if (locationSearch.kind !== 'idle') {
      setLocationSearch({ kind: 'idle' });
    }
  };

  const handleLocationSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const map = mapRef.current;
    const query = locationInput.trim();

    if (!map) {
      setLocationSearch({ kind: 'error' });
      return;
    }
    if (query.length < 3) {
      setLocationSearch({ kind: 'empty' });
      return;
    }

    abortLocationSearch();
    const controller = new AbortController();
    locationAbortRef.current = controller;
    setSearchTarget(null);
    setLocationSearch({ kind: 'searching' });

    const cacheKey = query.toLowerCase();
    try {
      let target: SearchTarget | null;
      if (locationCacheRef.current.has(cacheKey)) {
        target = locationCacheRef.current.get(cacheKey) ?? null;
      } else {
        const params = new URLSearchParams({
          q: query,
          format: 'jsonv2',
          countrycodes: 'us',
          limit: '1',
          addressdetails: '0',
          'accept-language': 'en',
        });
        const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`Geocoder returned ${response.status}`);

        const payload: unknown = await response.json();
        const first =
          Array.isArray(payload) && payload.length > 0
            ? (payload[0] as NominatimResult)
            : undefined;
        const lat = Number(first?.lat);
        const lng = Number(first?.lon);

        if (
          !first ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          !isUsPoint(lat, lng)
        ) {
          target = null;
        } else {
          target = {
            lat,
            lng,
            label:
              typeof first.display_name === 'string' && first.display_name.trim()
                ? first.display_name
                : query,
          };
        }

        // Nominatim's public policy requires caching; keep this small and local.
        const cache = locationCacheRef.current;
        cache.set(cacheKey, target);
        if (cache.size > LOCATION_CACHE_LIMIT) {
          const oldestKey = cache.keys().next().value;
          if (oldestKey !== undefined) cache.delete(oldestKey);
        }
      }

      if (controller.signal.aborted) return;
      if (!target) {
        setLocationSearch({ kind: 'empty' });
        return;
      }

      shouldFocusUser.current = false;
      map.closePopup();
      setSelectedCity(null);
      setSearchTarget(target);
      setLocationSearch({ kind: 'found', label: target.label });
      setMapView('free');
      map.flyTo([target.lat, target.lng], LOCATION_SEARCH_ZOOM, { duration: 0.6 });
    } catch {
      if (controller.signal.aborted) return;
      setLocationSearch({ kind: 'error' });
    } finally {
      if (locationAbortRef.current === controller) locationAbortRef.current = null;
    }
  };

  const isLocationSearching = locationSearch.kind === 'searching';

  return {
    locationInput,
    locationSearch,
    isLocationSearching,
    handleLocationInputChange,
    handleLocationSearch,
    clearLocationSearch,
  };
}
