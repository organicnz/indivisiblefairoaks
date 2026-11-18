'use client';

import { AlertTriangle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { computeRapidSurges } from '@/lib/ice-rapid-surges';
import { RapidAlertChannels } from './RapidAlertChannels';
import { RapidAlertFeed } from './RapidAlertFeed';
import { RapidFilterBar } from './RapidFilterBar';
import { RapidLiveRail } from './RapidLiveRail';
import { RapidMapPanel } from './RapidMapPanel';
import { RapidResponseGuide } from './RapidResponseGuide';
import { RapidSurgeBanner } from './RapidSurgeBanner';
import {
  countActiveAlerts,
  DEFAULT_RAPID_FILTERS,
  filterAlerts,
  groupRapidAlerts,
  type RapidFilters,
} from './rapid-alert-utils';
import type { RapidUrlState } from './rapid-types';
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
  const { feed, status, error, isRefreshing, refresh } = useRapidFeed();
  const [filters, setFilters] = useState<RapidFilters>(DEFAULT_RAPID_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialState.initialAlertId
  );
  const [showHistorical, setShowHistorical] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [searchTarget, setSearchTarget] = useState<SearchTarget | null>(null);

  const urlSyncEnabledRef = useRef(initialState.hasUrlState);
  const initialSelectionAppliedRef = useRef(false);
  const pendingFlyAlertRef = useRef<string | null>(initialState.initialAlertId);
  const selectAlertRef = useRef<(id: string, options?: { scroll?: boolean }) => void>(
    () => {}
  );

  const alerts = feed?.alerts ?? [];
  const officialReleases = feed?.officialReleases ?? [];
  const publicCases = feed?.publicCases ?? [];

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
  const selectedAlert = useMemo(
    () => alerts.find((alert) => alert.id === selectedId) ?? null,
    [alerts, selectedId]
  );

  const { userLocation, userLocationStatus, locationNotice } = useUserLocation({});

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
    zoomMap,
    flyToPoint,
    flyToOverview,
    flyToUser,
  } = useRapidMap({
    snapshot,
    points,
    publicCases,
    selectedAlertId: selectedId,
    searchTarget,
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
    });
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (next !== currentUrl) {
      window.history.replaceState(window.history.state, '', next);
    }
  }, [mapView, selectedId, viewport]);

  const handleMapSearch = (event: FormEvent<HTMLFormElement>) => {
    markUrlSync();
    pendingFlyAlertRef.current = null;
    setSelectedId(null);
    void handleLocationSearch(event);
  };

  const handleReset = () => {
    markUrlSync();
    clearLocationSearch();
    flyToOverview();
  };

  const handleLocate = () => {
    if (!userLocation) return;
    markUrlSync();
    clearLocationSearch();
    flyToUser(userLocation);
  };

  const handleZoom = (direction: 'in' | 'out') => {
    markUrlSync();
    zoomMap(direction);
  };

  const hasFilters =
    filters.query.trim().length > 0 ||
    filters.kind !== 'all' ||
    filters.status !== 'all' ||
    filters.time !== 'all';

  const clearFilters = () => setFilters(DEFAULT_RAPID_FILTERS);

  const updateFilter = <Key extends keyof RapidFilters>(
    key: Key,
    value: RapidFilters[Key]
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pb-6 pt-2 sm:px-6 sm:pb-8 lg:px-8">
        <RapidSurgeBanner
          surges={surges}
          status={status}
          now={now}
          onSelect={(id) => selectAlert(id, { scroll: false })}
        />

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
            points={points}
            filteredCount={filteredAlerts.length}
            activeCount={activeFilteredCount}
            publicCaseCount={publicCases.length}
            community={feed?.community ?? null}
            requestStatus={status}
            now={now}
            selectedAlert={selectedAlert}
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
              onChange={updateFilter}
              onClear={clearFilters}
              hasFilters={hasFilters}
              status={status}
              alertCount={alerts.length}
              filteredCount={filteredAlerts.length}
            />

            <RapidLiveRail
              alerts={alerts}
              community={feed?.community ?? null}
              now={now}
              status={status}
              onSelect={(id) => selectAlert(id)}
              onRefresh={refresh}
            />

            <RapidAlertFeed
              alerts={filteredAlerts}
              allAlerts={alerts}
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
