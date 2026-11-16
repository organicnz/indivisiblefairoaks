'use client';

import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import { useEffect, useRef, useState } from 'react';
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
import type { RapidMapPoint } from './rapid-types';
import type {
  HeatmapSnapshot,
  MapView,
  MapViewport,
  SearchTarget,
  UserLocation,
} from './types';

type UseRapidMapOptions = {
  snapshot: HeatmapSnapshot;
  points: RapidMapPoint[];
  selectedAlertId: string | null;
  searchTarget: SearchTarget | null;
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

export function useRapidMap({
  snapshot,
  points,
  selectedAlertId,
  searchTarget,
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

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const alertLayerRef = useRef<LayerGroup | null>(null);
  const historicalLayerRef = useRef<LayerGroup | null>(null);
  const searchLayerRef = useRef<LayerGroup | null>(null);
  const userLayerRef = useRef<LayerGroup | null>(null);
  const markerElementsRef = useRef<Record<string, HTMLElement>>({});
  const markerPositionsRef = useRef<Record<string, [number, number]>>({});
  const userLocationRef = useRef<UserLocation | null>(userLocation);
  const onSelectAlertRef = useRef(onSelectAlert);
  const onMapInteractionRef = useRef(onMapInteraction);
  const initialViewRef = useRef(initialView);

  useEffect(() => {
    onSelectAlertRef.current = onSelectAlert;
  }, [onSelectAlert]);

  useEffect(() => {
    onMapInteractionRef.current = onMapInteraction;
  }, [onMapInteraction]);

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
        preferCanvas: true,
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
      searchLayerRef.current = L.layerGroup().addTo(map);
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
    })();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      map?.remove();
      mapRef.current = null;
      alertLayerRef.current = null;
      historicalLayerRef.current = null;
      searchLayerRef.current = null;
      userLayerRef.current = null;
      markerElementsRef.current = {};
      markerPositionsRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    let disposed = false;

    void (async () => {
      const L = (await import('leaflet')).default;
      if (disposed) return;
      const layer = alertLayerRef.current;
      if (!layer) return;

      layer.clearLayers();
      markerElementsRef.current = {};
      markerPositionsRef.current = {};

      for (const point of points) {
        const classes = [
          'ice-rapid-marker',
          `ice-rapid-marker--${point.status === 'source-confirmed' ? 'confirmed' : 'sighting'}`,
        ];
        if (point.hasActive) classes.push('is-live');
        else classes.push('is-earlier');
        if (selectedAlertId && point.alertIds.includes(selectedAlertId)) {
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

        const element = marker.getElement();
        if (element) {
          element.setAttribute('role', 'button');
          element.setAttribute('aria-label', pointLabel(point));
          element.setAttribute(
            'aria-pressed',
            String(Boolean(selectedAlertId && point.alertIds.includes(selectedAlertId)))
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
  }, [isReady, points, selectedAlertId]);

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

    void (async () => {
      const L = (await import('leaflet')).default;
      if (disposed) return;
      const layer = historicalLayerRef.current;
      if (!layer) return;

      layer.clearLayers();
      if (!showHistorical) return;

      const maxCount = snapshot.meta.maxCityCount;
      for (const city of snapshot.cities.slice(0, 360)) {
        const radius = 2 + Math.sqrt(city.count / maxCount) * 9;
        L.circleMarker([city.lat, city.lng], {
          radius,
          color: '#64120d',
          weight: 1,
          opacity: 0.22,
          fillColor: '#b42318',
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(layer);
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
          approximate ? `Approximate area: ${userLocation.label}` : 'Your current location',
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

  return {
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
  };
}

export function rapidMapHelpText(alertCount: number, cityCount: number) {
  return `Interactive national rapid-response map with ${formatNumber(
    alertCount
  )} community reports grouped across ${formatNumber(
    cityCount
  )} cities. Pulsing pins mark reports received in the last four hours. Select a pin or a feed item for details. Locations are city centroids, not street addresses. This is not an emergency service.`;
}
