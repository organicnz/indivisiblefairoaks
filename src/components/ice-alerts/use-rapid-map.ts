'use client';

import type { LayerGroup, Map as LeafletMap, PopupOptions } from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CITY_FOCUS_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  NATIONWIDE_BOUNDS,
  NATIONWIDE_CENTER,
  NATIONWIDE_ZOOM,
  TILE_ATTRIBUTION,
  TILE_URL,
} from './constants';
import { formatNumber } from './data';
import { leafletText } from './leaflet-text';
import type { PublicCase, RapidMapPoint, RapidWatchRadius } from './rapid-types';
import { formatRelativeTime, KIND_LABELS, rapidPopupSummary } from './rapid-alert-utils';
import type {
  CityPoint,
  HeatmapSnapshot,
  MapView,
  MapViewport,
  SearchTarget,
  UserLocation,
} from './types';

type UseRapidMapOptions = {
  snapshot: HeatmapSnapshot;
  points: RapidMapPoint[];
  publicCases: PublicCase[];
  selectedAlertId: string | null;
  searchTarget: SearchTarget | null;
  watchRadius: RapidWatchRadius | null;
  userLocation: UserLocation | null;
  initialView: MapViewport | null;
  showHistorical: boolean;
  onSelectAlert: (id: string) => void;
  onMapInteraction?: () => void;
};

function syncMarkerVisibility(
  map: LeafletMap,
  elements: Record<string, HTMLElement>,
  positions: Record<string, [number, number]>
) {
  const bounds = map.getBounds();
  for (const [id, element] of Object.entries(elements)) {
    const position = positions[id];
    const visible = Boolean(position && bounds.contains(position));
    element.tabIndex = visible ? 0 : -1;

    if (visible || element.ownerDocument.activeElement === element) {
      element.removeAttribute('aria-hidden');
    } else {
      element.setAttribute('aria-hidden', 'true');
    }
  }
}

function pointLabel(point: RapidMapPoint) {
  const status =
    point.status === 'source-confirmed' ? 'Source-confirmed' : 'Community sighting';
  const count = point.count === 1 ? '1 report' : `${point.count} reports`;
  return `${point.place}: ${count}, ${status}. Open alert details.`;
}

const POPUP_OPTIONS: PopupOptions = {
  className: 'ice-map-popup-shell',
  maxWidth: 288,
  minWidth: 220,
  autoPan: true,
  closeButton: true,
  offset: [0, -12],
};

function popupText(className: string, text: string) {
  const element = document.createElement('p');
  element.className = className;
  element.textContent = text;
  return element;
}

type PopupAction = { label: string; onClick: () => void };
type PopupLink = { label: string; href: string };
type PopupContent = {
  className?: string;
  kicker: string;
  title: string;
  count: string;
  rank: string;
  strongest?: string | null;
  note: string;
  action?: PopupAction;
  link?: PopupLink;
};

function buildPopup({
  className,
  kicker,
  title,
  count,
  rank,
  strongest,
  note,
  action,
  link,
}: PopupContent) {
  const root = document.createElement('div');
  root.className = className ? `ice-map-popup ${className}` : 'ice-map-popup';
  root.append(
    popupText('ice-map-popup__kicker', kicker),
    popupText('ice-map-popup__title', title),
    popupText('ice-map-popup__count', count),
    popupText('ice-map-popup__rank', rank)
  );

  if (strongest) {
    root.append(
      popupText('ice-map-popup__rank ice-map-popup__rank--strongest', strongest)
    );
  }

  root.append(popupText('ice-map-popup__note', note));

  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ice-map-popup__action';
    button.textContent = action.label;
    button.addEventListener('click', action.onClick);
    root.append(button);
  }

  if (link) {
    const anchor = document.createElement('a');
    anchor.href = link.href;
    anchor.className = 'ice-map-popup__link';
    anchor.textContent = link.label;
    root.append(anchor);
  }

  return root;
}

function buildRapidPopup(
  point: RapidMapPoint,
  onViewLatest: () => void,
  onClose: () => void
) {
  const countLabel = `${formatNumber(point.count)} ${
    point.count === 1 ? 'report' : 'reports'
  }`;
  const popupSummary = rapidPopupSummary(point, Date.now());

  return buildPopup({
    className: 'ice-rapid-popup',
    kicker: point.hasActive ? 'Active community report' : 'Community report',
    title: point.place,
    count: countLabel,
    rank: popupSummary.latest,
    strongest: popupSummary.strongest,
    note: 'City-level location, not a street address. Open the latest report for source and safety details.',
    action: {
      label: 'View latest report',
      onClick: () => {
        onClose();
        onViewLatest();
      },
    },
  });
}

function publicCaseLabel(report: PublicCase) {
  return `${report.place}: published ${KIND_LABELS[report.kind].toLowerCase()} community case. Open popup.`;
}

function buildPublicCasePopup(report: PublicCase) {
  const combined =
    report.corroborationCount > 1
      ? ` · Combined from ${formatNumber(report.corroborationCount)} reports`
      : '';

  return buildPopup({
    className: 'ice-public-case-popup',
    kicker: 'Published community case',
    title: report.place,
    count: KIND_LABELS[report.kind],
    rank: `${formatRelativeTime(report.observedAt, Date.now())}${combined}`,
    note: report.summary,
    link: { label: 'Read all community reports', href: '#reviewed-reports' },
  });
}

/**
 * City-level cases share a centroid. Nudge coincident markers onto a small
 * ring so every published case remains individually clickable; the popup still
 * describes a city-level location, never a street address.
 */
function publicCasePosition(
  lat: number,
  lng: number,
  index: number
): [number, number] {
  if (index === 0) return [lat, lng];
  const angle = ((index - 1) % 8) * (Math.PI / 4);
  const ring = Math.floor((index - 1) / 8) + 1;
  const radius = 0.006 * ring;
  return [lat + Math.cos(angle) * radius, lng + Math.sin(angle) * radius];
}

function buildHistoricalCityPopup(city: CityPoint) {
  const cityKey = `foiaCity=${encodeURIComponent(city.city)}&foiaState=${encodeURIComponent(
    city.stateCode
  )}`;

  return buildPopup({
    kicker: 'FOIA context',
    title: `${city.city}, ${city.stateCode}`,
    count: `${formatNumber(city.count)} records`,
    rank: 'Historical city total',
    note: 'From the latest published FOIA release. Not a live alert or a street address.',
    link: {
      label: 'Open historical map',
      href: `/ice-alerts?view=history&${cityKey}#historical-foia`,
    },
  });
}

export function useRapidMap({
  snapshot,
  points,
  publicCases,
  selectedAlertId,
  searchTarget,
  watchRadius,
  userLocation,
  initialView,
  showHistorical,
  onSelectAlert,
  onMapInteraction,
}: UseRapidMapOptions) {
  const [mapView, setMapView] = useState<MapView>(
    initialView ? (initialView.zoom <= 5 ? 'nationwide' : 'free') : 'nationwide'
  );
  const [viewport, setViewport] = useState<MapViewport | null>(initialView);
  const [isReady, setIsReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const pointsRef = useRef(points);
  const publicCasesRef = useRef(publicCases);
  const mapRef = useRef<LeafletMap | null>(null);
  const alertLayerRef = useRef<LayerGroup | null>(null);
  const publicCaseLayerRef = useRef<LayerGroup | null>(null);
  const historicalLayerRef = useRef<LayerGroup | null>(null);
  const searchLayerRef = useRef<LayerGroup | null>(null);
  const watchRadiusLayerRef = useRef<LayerGroup | null>(null);
  const userLayerRef = useRef<LayerGroup | null>(null);
  const markerElementsRef = useRef<Record<string, HTMLElement>>({});
  const markerPositionsRef = useRef<Record<string, [number, number]>>({});
  const userLocationRef = useRef<UserLocation | null>(userLocation);
  const onSelectAlertRef = useRef(onSelectAlert);
  const onMapInteractionRef = useRef(onMapInteraction);
  const selectedAlertIdRef = useRef(selectedAlertId);
  const initialViewRef = useRef(initialView);
  const markerSignature = useMemo(() => JSON.stringify(points), [points]);
  const publicCasesSignature = useMemo(() => JSON.stringify(publicCases), [publicCases]);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    publicCasesRef.current = publicCases;
  }, [publicCases]);

  useEffect(() => {
    onSelectAlertRef.current = onSelectAlert;
  }, [onSelectAlert]);

  useEffect(() => {
    onMapInteractionRef.current = onMapInteraction;
  }, [onMapInteraction]);

  useEffect(() => {
    selectedAlertIdRef.current = selectedAlertId;
  }, [selectedAlertId]);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  useEffect(() => {
    let disposed = false;
    let map: LeafletMap | null = null;
    let resizeObserver: ResizeObserver | null = null;

    void (async () => {
      const L = (await import('leaflet')).default;
      if (disposed || !mapContainerRef.current || mapRef.current) return;

      const initial = initialViewRef.current;
      map = L.map(mapContainerRef.current, {
        center: initial?.center ?? NATIONWIDE_CENTER,
        zoom: initial?.zoom ?? NATIONWIDE_ZOOM,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        zoomControl: false,
        // The rapid map's historical overlay is capped at 360 points. SVG keeps
        // each city point addressable while the report and case markers remain
        // HTML markers on their own layers.
        preferCanvas: false,
        scrollWheelZoom: true,
        keyboard: true,
        attributionControl: true,
        worldCopyJump: true,
      });

      L.tileLayer(TILE_URL, {
        maxZoom: MAX_ZOOM,
        attribution: TILE_ATTRIBUTION,
      }).addTo(map);

      historicalLayerRef.current = L.layerGroup().addTo(map);
      alertLayerRef.current = L.layerGroup().addTo(map);
      publicCaseLayerRef.current = L.layerGroup().addTo(map);
      searchLayerRef.current = L.layerGroup().addTo(map);
      watchRadiusLayerRef.current = L.layerGroup().addTo(map);
      userLayerRef.current = L.layerGroup().addTo(map);

      const updateView = () => {
        if (!map) return;
        const center = map.getCenter();
        const zoom = map.getZoom();
        setViewport({ center: [center.lat, center.lng], zoom });

        if (zoom <= 5) {
          setMapView('nationwide');
          return;
        }

        const location = userLocationRef.current;
        setMapView(
          location && map.getBounds().contains([location.lat, location.lng])
            ? 'local'
            : 'free'
        );
      };

      map.on('moveend', () => {
        updateView();
        syncMarkerVisibility(
          map!,
          markerElementsRef.current,
          markerPositionsRef.current
        );
      });

      resizeObserver = new ResizeObserver(() => {
        map?.invalidateSize();
        if (map) {
          syncMarkerVisibility(
            map,
            markerElementsRef.current,
            markerPositionsRef.current
          );
        }
      });
      resizeObserver.observe(mapContainerRef.current);

      if (!initial) {
        map.fitBounds(NATIONWIDE_BOUNDS, { padding: [24, 24], animate: false });
      }

      let interactionReady = false;
      const handleInteraction = () => {
        if (!interactionReady) return;
        onMapInteractionRef.current?.();
      };
      map.on('dragstart zoomstart', handleInteraction);

      mapRef.current = map;
      setIsReady(true);
      updateView();
      requestAnimationFrame(() => {
        if (disposed) return;
        map?.invalidateSize();
        interactionReady = true;
      });
    })().catch((error) => {
      if (!disposed) {
        console.error('Unable to initialize the ICE rapid-response map', error);
        setMapError(true);
      }
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      map?.remove();
      mapRef.current = null;
      alertLayerRef.current = null;
      publicCaseLayerRef.current = null;
      historicalLayerRef.current = null;
      searchLayerRef.current = null;
      watchRadiusLayerRef.current = null;
      userLayerRef.current = null;
      markerElementsRef.current = {};
      markerPositionsRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    let disposed = false;
    // The 30-second clock recreates `points` even when no pin changed. Rebuild
    // only when marker content changes so an open popup is not closed on every
    // clock tick.
    const markerPoints = pointsRef.current;

    void (async () => {
      const L = (await import('leaflet')).default;
      if (disposed) return;
      const layer = alertLayerRef.current;
      if (!layer) return;

      layer.clearLayers();
      markerElementsRef.current = {};
      markerPositionsRef.current = {};

      for (const point of markerPoints) {
        const selectedId = selectedAlertIdRef.current;
        const classes = [
          'ice-rapid-marker',
          `ice-rapid-marker--${point.status === 'source-confirmed' ? 'confirmed' : 'sighting'}`,
        ];
        if (point.hasActive) classes.push('is-live');
        else classes.push('is-earlier');
        if (selectedId && point.alertIds.includes(selectedId)) {
          classes.push('is-selected');
        }

        const count =
          point.count > 1
            ? `<span class="ice-rapid-marker__count" aria-hidden="true">${point.count}</span>`
            : '';

        const marker = L.marker([point.lat, point.lng], {
          icon: L.divIcon({
            className: 'ice-rapid-marker-shell',
            html: `<span class="${classes.join(' ')}"><span class="ice-rapid-marker__pulse" aria-hidden="true"></span><span class="ice-rapid-marker__dot" aria-hidden="true"></span>${count}</span>`,
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          }),
          keyboard: true,
          title: pointLabel(point),
          riseOnHover: true,
        }).addTo(layer);

        marker.on('click', () => {
          onSelectAlertRef.current(point.latestAlertId);
        });
        marker.bindPopup(
          buildRapidPopup(
            point,
            () => onSelectAlertRef.current(point.latestAlertId),
            () => mapRef.current?.closePopup()
          ),
          POPUP_OPTIONS
        );

        const element = marker.getElement();
        if (element) {
          element.setAttribute('role', 'button');
          element.setAttribute('aria-label', pointLabel(point));
          element.setAttribute(
            'aria-pressed',
            String(Boolean(selectedId && point.alertIds.includes(selectedId)))
          );
          markerElementsRef.current[point.id] = element;
          markerPositionsRef.current[point.id] = [point.lat, point.lng];
        }
      }

      const map = mapRef.current;
      if (map) {
        syncMarkerVisibility(
          map,
          markerElementsRef.current,
          markerPositionsRef.current
        );
      }
    })();

    return () => {
      disposed = true;
    };
  }, [isReady, markerSignature]);

  useEffect(() => {
    for (const [id, element] of Object.entries(markerElementsRef.current)) {
      const point = points.find((candidate) => candidate.id === id);
      const selected = Boolean(
        selectedAlertId && point?.alertIds.includes(selectedAlertId)
      );
      const marker = element.querySelector('.ice-rapid-marker');
      marker?.classList.toggle('is-selected', Boolean(selected));
      element.setAttribute('aria-pressed', String(Boolean(selected)));
    }
  }, [points, selectedAlertId]);

  useEffect(() => {
    if (!isReady) return;
    let disposed = false;

    const markerCases = publicCasesRef.current;

    void (async () => {
      const L = (await import('leaflet')).default;
      if (disposed) return;
      const layer = publicCaseLayerRef.current;
      if (!layer) return;

      layer.clearLayers();
      const placed = new Map<string, number>();

      for (const report of markerCases) {
        const placeKey = `${report.city}|${report.stateCode}`;
        const index = placed.get(placeKey) ?? 0;
        placed.set(placeKey, index + 1);
        const [lat, lng] = publicCasePosition(report.lat, report.lng, index);

        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'ice-public-case-shell',
            html: '<span class="ice-public-case-marker" aria-hidden="true"><span class="ice-public-case-marker__dot"></span></span>',
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          }),
          keyboard: true,
          title: publicCaseLabel(report),
          riseOnHover: true,
        }).addTo(layer);

        marker.bindTooltip(
          leafletText(`${report.place} · ${KIND_LABELS[report.kind]} community case`),
          { direction: 'top', offset: [0, -12] }
        );
        marker.bindPopup(buildPublicCasePopup(report), POPUP_OPTIONS);

        const element = marker.getElement();
        if (element) {
          element.setAttribute('role', 'button');
          element.setAttribute('aria-label', publicCaseLabel(report));
        }
      }
    })();

    return () => {
      disposed = true;
    };
  }, [isReady, publicCasesSignature]);

  useEffect(() => {
    if (!isReady) return;
    let disposed = false;

    void (async () => {
      const L = (await import('leaflet')).default;
      if (disposed) return;
      const layer = historicalLayerRef.current;
      if (!layer) return;

      layer.clearLayers();
      if (!showHistorical) return;

      const maxCount = snapshot.meta.maxCityCount;
      // Render larger totals last so an overlapping small point cannot steal
      // the click from the city a reader is trying to inspect.
      const historicalCities = snapshot.cities
        .slice(0, 360)
        .sort((a, b) => a.count - b.count);
      for (const city of historicalCities) {
        const radius = 2 + Math.sqrt(city.count / maxCount) * 9;
        const marker = L.circleMarker([city.lat, city.lng], {
          className: 'ice-historical-city',
          radius,
          color: '#64120d',
          weight: 1,
          opacity: 0.22,
          fillColor: '#b42318',
          fillOpacity: 0.08,
          interactive: true,
        })
          .bindTooltip(
            leafletText(
              `${city.city}, ${city.stateCode} · ${formatNumber(
                city.count
              )} historical records`
            ),
            { direction: 'top' }
          )
          .bindPopup(buildHistoricalCityPopup(city), POPUP_OPTIONS)
          .addTo(layer);
        marker.getElement()?.setAttribute('data-city', city.city);
      }
    })();

    return () => {
      disposed = true;
    };
  }, [isReady, showHistorical, snapshot]);

  useEffect(() => {
    if (!isReady) return;
    let disposed = false;

    void (async () => {
      const L = (await import('leaflet')).default;
      if (disposed) return;
      const layer = searchLayerRef.current;
      if (!layer) return;

      layer.clearLayers();
      if (!searchTarget) return;

      const marker = L.marker([searchTarget.lat, searchTarget.lng], {
        icon: L.divIcon({
          className: 'ice-map-search-target',
          html: '<span class="ice-map-search-pin" aria-hidden="true"></span>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
        interactive: false,
        keyboard: false,
      }).addTo(layer);
      marker.getElement()?.setAttribute('aria-hidden', 'true');
    })();

    return () => {
      disposed = true;
    };
  }, [isReady, searchTarget]);

  useEffect(() => {
    if (!isReady) return;
    let disposed = false;

    void (async () => {
      const L = (await import('leaflet')).default;
      if (disposed) return;
      const layer = watchRadiusLayerRef.current;
      if (!layer) return;

      layer.clearLayers();
      if (!watchRadius) return;

      L.circle([watchRadius.lat, watchRadius.lng], {
        radius: watchRadius.miles * 1609.344,
        color: '#b42318',
        weight: 1.5,
        opacity: 0.8,
        dashArray: '6 6',
        fillColor: '#b42318',
        fillOpacity: 0.04,
        interactive: false,
      }).addTo(layer);
    })();

    return () => {
      disposed = true;
    };
  }, [isReady, watchRadius]);

  useEffect(() => {
    if (!isReady) return;
    let disposed = false;

    void (async () => {
      const L = (await import('leaflet')).default;
      if (disposed) return;
      const layer = userLayerRef.current;
      if (!layer) return;

      layer.clearLayers();
      if (!userLocation) return;

      const approximate = userLocation.precision === 'approximate';
      const marker = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
          className: `ice-user-location ${approximate ? 'is-approximate' : 'is-precise'}`,
          html: '<span class="ice-user-location__ring" aria-hidden="true"></span><span class="ice-user-location__dot" aria-hidden="true"></span>',
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
        interactive: false,
        keyboard: false,
      })
        .bindTooltip(
          leafletText(
            approximate ? `Approximate area: ${userLocation.label}` : 'Your current location'
          ),
          { direction: 'top', offset: [0, -12] }
        )
        .addTo(layer);

      marker.getElement()?.setAttribute('aria-hidden', 'true');
    })();

    return () => {
      disposed = true;
    };
  }, [isReady, userLocation]);

  const zoomMap = (direction: 'in' | 'out') => {
    mapRef.current?.closePopup();
    if (direction === 'in') mapRef.current?.zoomIn();
    else mapRef.current?.zoomOut();
  };

  const flyToPoint = (point: Pick<RapidMapPoint, 'lat' | 'lng'>) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo(
      [point.lat, point.lng],
      Math.max(map.getZoom(), CITY_FOCUS_ZOOM),
      { duration: 0.5 }
    );
  };

  const flyToOverview = () => {
    mapRef.current?.fitBounds(NATIONWIDE_BOUNDS, { padding: [24, 24], duration: 0.4 });
  };

  const flyToUser = (location: UserLocation) => {
    mapRef.current?.flyTo(
      [location.lat, location.lng],
      location.precision === 'precise' ? 11 : 7,
      { duration: 0.6 }
    );
  };

  const flyToWatchRadius = (radius: RapidWatchRadius) => {
    const map = mapRef.current;
    if (!map) return;
    const zoom =
      radius.miles <= 25 ? 11 : radius.miles <= 50 ? 10 : radius.miles <= 100 ? 9 : 8;
    map.flyTo([radius.lat, radius.lng], zoom, { duration: 0.6 });
  };

  return {
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
  };
}

export function rapidMapHelpText(
  alertCount: number,
  cityCount: number,
  publicCaseCount = 0
) {
  const cases =
    publicCaseCount > 0
      ? ` ${formatNumber(
          publicCaseCount
        )} published community cases are separate diamond markers; select one for its own popup.`
      : '';

  return `Interactive national rapid-response map with ${formatNumber(
    alertCount
  )} community reports grouped across ${formatNumber(
    cityCount
  )} cities.${cases} Pulsing pins mark reports received in the last four hours. Select a report pin for an on-map popup, or a feed item for the detail panel. With FOIA context on, select a city point for its historical total. Locations are city centroids, not street addresses. This is not an emergency service.`;
}
