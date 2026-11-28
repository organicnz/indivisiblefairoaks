'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IceAlertBanner } from './IceAlertBanner';
import { IceCaseDocumentation } from './IceCaseDocumentation';
import { IceMapPanel } from './IceMapPanel';
import { IceReadingGuide } from './IceReadingGuide';
import { IceSidebar } from './IceSidebar';
import { type IceMapUrlState, serializeIceMapUrlState } from './map-url-state';
import type { CityPoint, HeatmapSnapshot, SearchTarget } from './types';
import { useIceMap } from './use-ice-map';
import { useLocationSearch } from './use-location-search';
import { useUserLocation } from './use-user-location';

type IceArrestHeatMapProps = {
  snapshot: HeatmapSnapshot;
  initialState?: IceMapUrlState;
  /** Prefix URL state when this map shares a page with another Leaflet map. */
  urlKeyPrefix?: string;
  /** Recalculate the map size when an enclosing disclosure opens. */
  isActive?: boolean;
};

/**
 * Historical ICE arrest city-circle map.
 *
 * This component owns only the state the three concerns share: the selected
 * city, the search target, and the "focus the user's area" intent. The map,
 * location and place-search logic live in their own hooks so each can be
 * reasoned about — and tested — without the other two.
 */
export function IceArrestHeatMap({
  snapshot,
  initialState,
  urlKeyPrefix,
  isActive = true,
}: IceArrestHeatMapProps) {
  const [selectedCity, setSelectedCity] = useState<CityPoint | null>(
    initialState?.selectedCity ?? null
  );
  const [searchTarget, setSearchTarget] = useState<SearchTarget | null>(
    initialState?.searchTarget ?? null
  );
  const shouldFocusUserRef = useRef(!initialState?.hasUrlState);
  const allowAutoFocusRef = useRef(!initialState?.hasUrlState);
  const urlSyncEnabledRef = useRef(Boolean(initialState?.hasUrlState));

  const markUrlSyncEnabled = useCallback(() => {
    urlSyncEnabledRef.current = true;
  }, []);

  const selectCity = useCallback(
    (city: CityPoint) => {
      markUrlSyncEnabled();
      allowAutoFocusRef.current = false;
      setSelectedCity(city);
    },
    [markUrlSyncEnabled]
  );

  const { userLocation, userLocationRef, userLocationStatus, locationNotice } = useUserLocation({
    shouldFocusUser: shouldFocusUserRef,
  });

  const {
    mapContainerRef,
    mapRef,
    mapView,
    mapViewport,
    setMapView,
    heatStatus,
    zoomMap,
    flyToCity,
    flyToUsOverview,
    flyToUser,
  } = useIceMap({
    snapshot,
    selectedCity,
    searchTarget,
    userLocation,
    userLocationRef,
    shouldFocusUser: shouldFocusUserRef,
    allowAutoFocus: allowAutoFocusRef,
    initialView: initialState?.initialView ?? null,
    initialMapView: initialState?.initialMapView ?? 'nationwide',
    onCitySelect: selectCity,
    onMapInteraction: markUrlSyncEnabled,
  });

  const {
    locationInput,
    locationSearch,
    isLocationSearching,
    handleLocationInputChange,
    handleLocationSearch,
    clearLocationSearch,
  } = useLocationSearch({
    mapRef,
    searchTarget,
    initialInput: initialState?.searchQuery || initialState?.searchTarget?.label || '',
    initialTarget: initialState?.searchTarget ?? null,
    setMapView,
    setSelectedCity,
    setSearchTarget,
    shouldFocusUser: shouldFocusUserRef,
  });

  useEffect(() => {
    if (!urlSyncEnabledRef.current || !mapViewport) return;

    const current = new URLSearchParams(window.location.search);
    const params = serializeIceMapUrlState(
      current,
      {
        selectedCity,
        searchTarget,
        searchQuery: locationInput,
        viewport: mapViewport,
        mapView,
      },
      { keyPrefix: urlKeyPrefix }
    );
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (next !== currentUrl) {
      // A view change is not a route navigation. replaceState keeps the URL
      // shareable without turning every pan into a Back-button entry.
      window.history.replaceState(window.history.state, '', next);
    }
  }, [locationInput, mapView, mapViewport, searchTarget, selectedCity, urlKeyPrefix]);

  useEffect(() => {
    if (!isActive) return;
    const frame = requestAnimationFrame(() => mapRef.current?.invalidateSize());
    return () => cancelAnimationFrame(frame);
  }, [isActive, mapRef]);

  const isLocating = userLocationStatus === 'locating' || userLocationStatus === 'checking';

  const locationHeadline =
    userLocationStatus === 'checking'
      ? 'Finding your approximate area…'
      : userLocationStatus === 'locating'
        ? 'Refining your area…'
        : userLocation?.precision === 'precise'
          ? 'Using your current location'
          : userLocation
            ? `Approximate area: ${userLocation.label}`
            : 'Showing the U.S. overview';

  const locationDetail =
    locationNotice ??
    (userLocationStatus === 'checking'
      ? 'Using your network for a rough starting point. You can still browse the full map.'
      : userLocationStatus === 'locating'
        ? 'Refining the map with your device location. You can keep browsing while it resolves.'
        : userLocation?.precision === 'precise'
          ? 'Location is used only to center this map. It is not stored or added to the ICE data.'
          : userLocation
            ? 'Based on your network, not your exact address. It only centers the map and is not stored.'
            : 'No approximate area was available. Search for a city or explore the U.S. map.');

  const focusCity = (city: CityPoint) => {
    mapRef.current?.closePopup();
    selectCity(city);
    setMapView('free');
    flyToCity(city);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      document
        .getElementById('ice-map-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const focusOverview = () => {
    mapRef.current?.closePopup();
    markUrlSyncEnabled();
    allowAutoFocusRef.current = false;
    clearLocationSearch();
    setSelectedCity(null);
    setMapView('nationwide');
    flyToUsOverview();
  };

  const focusUserArea = () => {
    if (!userLocation) return;

    mapRef.current?.closePopup();
    markUrlSyncEnabled();
    allowAutoFocusRef.current = true;
    clearLocationSearch();
    setSelectedCity(null);
    setMapView('local');
    flyToUser(userLocation);
  };

  const handleMapSearch = (event: FormEvent<HTMLFormElement>) => {
    markUrlSyncEnabled();
    allowAutoFocusRef.current = false;
    void handleLocationSearch(event);
  };

  const handleMapZoom = (direction: 'in' | 'out') => {
    markUrlSyncEnabled();
    allowAutoFocusRef.current = false;
    zoomMap(direction);
  };

  const clearSelectedCity = () => {
    setSelectedCity(null);
  };

  return (
    <>
      <IceAlertBanner meta={snapshot.meta} />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.42fr)_minmax(22rem,0.78fr)]">
          <IceMapPanel
            meta={snapshot.meta}
            mapView={mapView}
            heatStatus={heatStatus}
            mapContainerRef={mapContainerRef}
            locationInput={locationInput}
            locationSearch={locationSearch}
            isLocationSearching={isLocationSearching}
            userLocation={userLocation}
            userLocationStatus={userLocationStatus}
            isLocating={isLocating}
            locationHeadline={locationHeadline}
            locationDetail={locationDetail}
            onLocationInputChange={handleLocationInputChange}
            onLocationSearch={handleMapSearch}
            onFocusOverview={focusOverview}
            onFocusUserArea={focusUserArea}
            onZoom={handleMapZoom}
            onReset={focusOverview}
          />

          <IceSidebar
            snapshot={snapshot}
            selectedCity={selectedCity}
            onSelectCity={focusCity}
            onClearSelectedCity={clearSelectedCity}
          />
        </div>
      </section>

      <IceReadingGuide meta={snapshot.meta} />
      <IceCaseDocumentation meta={snapshot.meta} />
    </>
  );
}
