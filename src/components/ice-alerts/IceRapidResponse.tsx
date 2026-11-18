'use client';

import { AlertTriangle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { computeRapidSurges } from '@/lib/ice-rapid-surges';
import { RapidAlertChannels } from './RapidAlertChannels';
import { RapidAlertFeed } from './RapidAlertFeed';
import { RapidCacheBanner } from './RapidCacheBanner';
import { RapidFilterBar } from './RapidFilterBar';
import { RapidLiveRail } from './RapidLiveRail';
import { RapidLocalWatch } from './RapidLocalWatch';
import { RapidMapPanel } from './RapidMapPanel';
import { useNewRapidAlerts } from './rapid-new';
import { RapidNewReportsBanner } from './RapidNewReportsBanner';
import { RapidResponseGuide } from './RapidResponseGuide';
import { RapidSurgeBanner } from './RapidSurgeBanner';
import {
  countActiveAlerts,
  DEFAULT_RAPID_FILTERS,
  filterAlerts,
  groupRapidAlerts,
  type RapidFilters,
} from './rapid-alert-utils';
import type { RapidUrlState, RapidWatchRadius } from './rapid-types';
import { serializeRapidUrlState } from './rapid-url-state';
import type { HeatmapSnapshot, SearchTarget } from './types';
import { useLocationSearch } from './use-location-search';
import { useRapidFeed } from './use-rapid-feed';
import { useRapidMap } from './use-rapid-map';
import { useUserLocation } from './use-user-location';

type IceRapidResponseProps = {
  snapshot: HeatmapSnapshot;
  initialState: RapidUrlState;
  children?: ReactNode;
};

export function IceRapidResponse({ snapshot, initialState, children }: IceRapidResponseProps) {
  const { feed, status, error, isRefreshing, refresh, cache } = useRapidFeed();
  const [filters, setFilters] = useState<RapidFilters>(initialState.initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialState.initialAlertId
  );
  const [showHistorical, setShowHistorical] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [searchTarget, setSearchTarget] = useState<SearchTarget | null>(null);
  const [watchRadius, setWatchRadius] = useState<RapidWatchRadius | null>(null);

  const urlSyncEnabledRef = useRef(initialState.hasUrlState);
  const initialSelectionAppliedRef = useRef(false);
  const pendingFlyAlertRef = useRef<string | null>(initialState.initialAlertId);
  const selectAlertRef = useRef<(id: string, options?: { scroll?: boolean }) => void>(
    () => {}
  );

  const alerts = feed?.alerts ?? [];
  const officialReleases = feed?.officialReleases ?? [];
  const publicCases = feed?.publicCases ?? [];
  const newIds = useNewRapidAlerts(alerts, status === 'ready' && !cache.fromCache);

  const filteredAlerts = useMemo(
    () => filterAlerts(alerts, filters, now),
    [alerts, filters, now]
  );
  const points = useMemo(() => groupRapidAlerts(filteredAlerts, now), [filteredAlerts, now]);
  const activeFilteredCount = useMemo(
    () => countActiveAlerts(filteredAlerts, now),
    [filteredAlerts, now]
  );
  const surges = useMemo(() => computeRapidSurges(alerts, now), [alerts, now]);
  const stateOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const alert of alerts) {
      const stateCode = alert.stateCode.trim().toUpperCase();
      if (!stateCode) continue;
      counts.set(stateCode, (counts.get(stateCode) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  }, [alerts]);
  const selectedAlert = useMemo(
    () => alerts.find((alert) => alert.id === selectedId) ?? null,
    [alerts, selectedId]
  );
  const selectedCityAlerts = useMemo(() => {
    if (!selectedAlert) return [];
    return alerts.filter(
      (alert) =>
        alert.stateCode === selectedAlert.stateCode &&
        alert.city.toLowerCase() === selectedAlert.city.toLowerCase()
    );
  }, [alerts, selectedAlert]);
  const selectedCityPublicCases = useMemo(() => {
    if (!selectedAlert) return [];
    return publicCases.filter(
      (publicCase) =>
        publicCase.stateCode === selectedAlert.stateCode &&
        publicCase.city.toLowerCase() === selectedAlert.city.toLowerCase()
    );
  }, [publicCases, selectedAlert]);
  const selectedHistoricalCity = useMemo(() => {
    if (!selectedAlert) return null;
    return (
      snapshot.cities.find(
        (city) =>
          city.stateCode === selectedAlert.stateCode &&
          city.city.toLowerCase() === selectedAlert.city.toLowerCase()
      ) ?? null
    );
  }, [selectedAlert, snapshot.cities]);

  const { userLocation, userLocationStatus, locationNotice, requestPrecise } =
    useUserLocation({});

  const markUrlSync = useCallback(() => {
    urlSyncEnabledRef.current = true;
  }, []);

  const handleMapSelect = useCallback((id: string) => {
    selectAlertRef.current(id, { scroll: false });
  }, []);

  const {
    mapContainerRef,
    mapRef,
    mapView,
    setMapView,
    viewport,
    isReady,
    mapError,
    zoomMap,
    flyToPoint,
    flyToOverview,
    flyToUser,
    flyToWatchRadius,
  } = useRapidMap({
    snapshot,
    points,
    publicCases,
    selectedAlertId: selectedId,
    searchTarget,
    watchRadius,
    userLocation,
    initialView: initialState.initialView,
    showHistorical,
    onSelectAlert: handleMapSelect,
    onMapInteraction: markUrlSync,
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
    setSearchTarget,
  });

  const selectAlert = useCallback(
    (id: string, options: { scroll?: boolean } = {}) => {
      markUrlSync();
      setSelectedId(id);

      const point = points.find((candidate) => candidate.alertIds.includes(id));
      const alert = alerts.find((candidate) => candidate.id === id);
      if (point) {
        flyToPoint(point);
      } else if (alert) {
        flyToPoint(alert);
      }

      if (
        options.scroll !== false &&
        window.matchMedia('(max-width: 1023px)').matches
      ) {
        document
          .getElementById('ice-rapid-map-panel')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [alerts, flyToPoint, markUrlSync, points]
  );

  selectAlertRef.current = selectAlert;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!feed || initialSelectionAppliedRef.current) return;
    initialSelectionAppliedRef.current = true;

    const requested = initialState.initialAlertId
      ? feed.alerts.find((alert) => alert.id === initialState.initialAlertId)
      : null;
    const fallback = feed.alerts[0] ?? null;
    setSelectedId(requested?.id ?? fallback?.id ?? null);
    if (requested) pendingFlyAlertRef.current = requested.id;
  }, [feed, initialState.initialAlertId]);

  useEffect(() => {
    if (!isReady || !pendingFlyAlertRef.current) return;
    const requested = pendingFlyAlertRef.current;
    const point = points.find((candidate) => candidate.alertIds.includes(requested));
    if (point) {
      flyToPoint(point);
      pendingFlyAlertRef.current = null;
    }
  }, [flyToPoint, isReady, points]);

  useEffect(() => {
    if (!feed) return;
    if (filteredAlerts.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (selectedId && !filteredAlerts.some((alert) => alert.id === selectedId)) {
      setSelectedId(filteredAlerts[0].id);
    }
  }, [feed, filteredAlerts, selectedId]);

  useEffect(() => {
    if (!urlSyncEnabledRef.current || !viewport) return;

    const current = new URLSearchParams(window.location.search);
    const params = serializeRapidUrlState(current, {
      viewport,
      mapView,
      selectedAlertId: selectedId,
      filters,
    });
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (next !== currentUrl) {
      window.history.replaceState(window.history.state, '', next);
    }
  }, [filters, mapView, selectedId, viewport]);

  const handleMapSearch = (event: FormEvent<HTMLFormElement>) => {
    markUrlSync();
    pendingFlyAlertRef.current = null;
    setSelectedId(null);
    setWatchRadius(null);
    void handleLocationSearch(event);
  };

  const handleReset = () => {
    markUrlSync();
    setWatchRadius(null);
    clearLocationSearch();
    flyToOverview();
  };

  const handleLocate = () => {
    if (!userLocation) {
      setWatchRadius(null);
      clearLocationSearch();
      requestPrecise();
      return;
    }
    markUrlSync();
    setWatchRadius(null);
    clearLocationSearch();
    flyToUser(userLocation);
  };

  const handleClearAnchor = () => {
    setWatchRadius(null);
    clearLocationSearch();
  };

  const handleShowRadius = (radius: RapidWatchRadius) => {
    markUrlSync();
    setWatchRadius(radius);
    flyToWatchRadius(radius);
  };

  const handleZoom = (direction: 'in' | 'out') => {
    markUrlSync();
    zoomMap(direction);
  };

  const hasFilters =
    filters.query.trim().length > 0 ||
    filters.kind !== 'all' ||
    filters.status !== 'all' ||
    filters.stateCode.length > 0 ||
    filters.time !== 'all';

  const clearFilters = () => {
    markUrlSync();
    setFilters(DEFAULT_RAPID_FILTERS);
  };

  const updateFilter = <Key extends keyof RapidFilters>(
    key: Key,
    value: RapidFilters[Key]
  ) => {
    markUrlSync();
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pb-6 pt-2 sm:px-6 sm:pb-8 lg:px-8">
        {cache.fromCache ? (
          <RapidCacheBanner
            cachedAt={cache.cachedAt}
            now={now}
            isRefreshing={isRefreshing}
            onRefresh={refresh}
          />
        ) : (
          <RapidSurgeBanner
            surges={surges}
            status={status}
            community={feed?.community ?? null}
            now={now}
            onSelect={(id) => {
              // A surge is global, so it can fall outside the current filters.
              // Clear them before selecting so the selection-sync effect does not
              // immediately replace the alert the reader just chose.
              setFilters(DEFAULT_RAPID_FILTERS);
              selectAlert(id, { scroll: false });
            }}
          />
        )}

        {!cache.fromCache && status === 'ready' ? (
          <RapidNewReportsBanner
            count={newIds.size}
            onShowNew={() => {
              const next = alerts.find((alert) => newIds.has(alert.id));
              if (!next) return;
              // New rows may be outside the current filters; clear them so the
              // selection-sync effect does not replace the report immediately.
              setFilters(DEFAULT_RAPID_FILTERS);
              selectAlert(next.id, { scroll: false });
            }}
          />
        ) : null}

        {status === 'error' && !feed ? (
          <div
            role="status"
            className="mt-4 flex flex-wrap items-center gap-3 border border-accent/40 bg-accent/10 p-3.5 text-xs leading-relaxed text-foreground"
          >
            <AlertTriangle className="size-4 shrink-0 text-accent" aria-hidden="true" />
            <p className="min-w-0 flex-1">
              The rapid-response feed is temporarily unavailable. The historical FOIA map is still
              available, and we will not show substitute reports while the feed is down.
            </p>
            <a
              href="#historical-foia"
              className="inline-flex min-h-8 items-center border border-border bg-background px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground transition-colors hover:border-foreground"
            >
              Historical map
            </a>
          </div>
        ) : null}

        <div className="mt-3 grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(23rem,0.82fr)]">
          <RapidMapPanel
            mapContainerRef={mapContainerRef}
            mapView={mapView}
            isReady={isReady}
            mapError={mapError}
            points={points}
            filteredCount={filteredAlerts.length}
            activeCount={activeFilteredCount}
            publicCaseCount={publicCases.length}
            community={feed?.community ?? null}
            feedFromCache={cache.fromCache}
            requestStatus={status}
            now={now}
            selectedAlert={selectedAlert}
            cityAlerts={selectedCityAlerts}
            cityPublicCases={selectedCityPublicCases}
            historicalCity={selectedHistoricalCity}
            onClearSelected={() => setSelectedId(null)}
            onZoom={handleZoom}
            onReset={handleReset}
            onLocate={handleLocate}
            userLocation={userLocation}
            userLocationStatus={userLocationStatus}
            locationNotice={locationNotice}
            locationInput={locationInput}
            locationSearch={locationSearch}
            isLocationSearching={isLocationSearching}
            onLocationInputChange={handleLocationInputChange}
            onLocationSearch={handleMapSearch}
            showHistorical={showHistorical}
            onToggleHistorical={() => setShowHistorical((current) => !current)}
          />

          <div className="min-w-0 space-y-3">
            <RapidFilterBar
              filters={filters}
              states={stateOptions}
              onChange={updateFilter}
              onClear={clearFilters}
              hasFilters={hasFilters}
              status={status}
              alertCount={alerts.length}
              filteredCount={filteredAlerts.length}
            />

            <RapidLiveRail
              alerts={filteredAlerts}
              community={feed?.community ?? null}
              now={now}
              status={status}
              hasFilters={hasFilters}
              onSelect={(id) => selectAlert(id)}
              onRefresh={refresh}
              onClearFilters={clearFilters}
            />

            <RapidLocalWatch
              points={points}
              community={feed?.community ?? null}
              feedFromCache={cache.fromCache}
              userLocation={userLocation}
              userLocationStatus={userLocationStatus}
              searchTarget={searchTarget}
              status={status}
              hasFilters={hasFilters}
              now={now}
              onSelect={(id) => selectAlert(id)}
              onLocate={handleLocate}
              onRequestLocation={requestPrecise}
              onClearAnchor={handleClearAnchor}
              onShowRadius={handleShowRadius}
              locationNotice={locationNotice}
            />

            <RapidAlertFeed
              alerts={filteredAlerts}
              allAlerts={alerts}
              newIds={newIds}
              officialReleases={officialReleases}
              community={feed?.community ?? null}
              official={feed?.official ?? null}
              selectedId={selectedId}
              now={now}
              status={status}
              error={error}
              isRefreshing={isRefreshing}
              onSelect={(id) => selectAlert(id)}
              onRefresh={refresh}
              onClearFilters={clearFilters}
              hasFilters={hasFilters}
            />

          </div>
        </div>
      </section>

      {children}

      <RapidAlertChannels />

      <RapidResponseGuide
        historicalMeta={snapshot.meta}
        community={feed?.community ?? null}
        official={feed?.official ?? null}
        now={now}
      />
    </>
  );
}
