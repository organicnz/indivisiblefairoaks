'use client';

import { useRef, useState } from 'react';
import { IceAlertBanner } from './IceAlertBanner';
import { IceCaseDocumentation } from './IceCaseDocumentation';
import { IceMapPanel } from './IceMapPanel';
import { IceReadingGuide } from './IceReadingGuide';
import { IceSidebar } from './IceSidebar';
import type { CityPoint, SearchTarget } from './types';
import { useIceMap } from './use-ice-map';
import { useLocationSearch } from './use-location-search';
import { useUserLocation } from './use-user-location';

/**
 * Historical ICE arrest city-circle map.
 *
 * This component owns only the state the three concerns share: the selected
 * city, the search target, and the "focus the user's area" intent. The map,
 * location and place-search logic live in their own hooks so each can be
 * reasoned about — and tested — without the other two.
 */
export function IceArrestHeatMap() {
  const [selectedCity, setSelectedCity] = useState<CityPoint | null>(null);
  const [searchTarget, setSearchTarget] = useState<SearchTarget | null>(null);
  const shouldFocusUserRef = useRef(true);

  const { userLocation, userLocationRef, userLocationStatus, locationNotice } = useUserLocation({
    shouldFocusUser: shouldFocusUserRef,
  });

  const {
    mapContainerRef,
    mapRef,
    mapView,
    setMapView,
    heatStatus,
    zoomMap,
    flyToCity,
    flyToUsOverview,
    flyToUser,
  } = useIceMap({
    selectedCity,
    searchTarget,
    userLocation,
    userLocationRef,
    shouldFocusUser: shouldFocusUserRef,
    onCitySelect: setSelectedCity,
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
    setMapView,
    setSelectedCity,
    setSearchTarget,
    shouldFocusUser: shouldFocusUserRef,
  });

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
    setSelectedCity(city);
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
    clearLocationSearch();
    setSelectedCity(null);
    setMapView('nationwide');
    flyToUsOverview();
  };

  const focusUserArea = () => {
    if (!userLocation) return;

    mapRef.current?.closePopup();
    clearLocationSearch();
    setSelectedCity(null);
    setMapView('local');
    flyToUser(userLocation);
  };

  return (
    <>
      <IceAlertBanner />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.42fr)_minmax(22rem,0.78fr)]">
          <IceMapPanel
            mapView={mapView}
            heatStatus={heatStatus}
            mapContainerRef={mapContainerRef}
            locationInput={locationInput}
            locationSearch={locationSearch}
            isLocationSearching={isLocationSearching}
            userLocation={userLocation}
            isLocating={isLocating}
            locationHeadline={locationHeadline}
            locationDetail={locationDetail}
            onLocationInputChange={handleLocationInputChange}
            onLocationSearch={handleLocationSearch}
            onFocusOverview={focusOverview}
            onFocusUserArea={focusUserArea}
            onZoom={zoomMap}
            onReset={focusOverview}
          />

          <IceSidebar
            selectedCity={selectedCity}
            onSelectCity={focusCity}
            onClearSelectedCity={() => setSelectedCity(null)}
          />
        </div>
      </section>

      <IceReadingGuide />
      <IceCaseDocumentation />
    </>
  );
}
