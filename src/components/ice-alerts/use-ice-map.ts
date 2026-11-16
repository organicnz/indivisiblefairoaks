'use client';

import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  APPROXIMATE_ZOOM,
  CITY_FOCUS_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  NATIONWIDE_BOUNDS,
  NATIONWIDE_CENTER,
  NATIONWIDE_ZOOM,
  PRECISE_ZOOM,
  TILE_ATTRIBUTION,
  TILE_URL,
} from './constants';
import { cityRank, citySharePercent, formatNumber, selectedCityLabel } from './data';
import { CITY_CIRCLE_STYLE, cityCircleRadius } from './map-circles';
import {
  clusterCellSize,
  clusterCityPoints,
  clusterIconSize,
  formatCompactCount,
  MAX_INDIVIDUAL_ZOOM,
  type CityCluster,
} from './map-clusters';
import type {
  CityPoint,
  HeatStatus,
  HeatmapSnapshot,
  MapView,
  MapViewport,
  SearchTarget,
  UserLocation,
} from './types';

type UseIceMapOptions = {
  snapshot: HeatmapSnapshot;
  selectedCity: CityPoint | null;
  searchTarget: SearchTarget | null;
  userLocation: UserLocation | null;
  userLocationRef: RefObject<UserLocation | null>;
  shouldFocusUser: RefObject<boolean>;
  allowAutoFocus: RefObject<boolean>;
  initialView: MapViewport | null;
  initialMapView: MapView;
  onCitySelect: (city: CityPoint) => void;
  onMapInteraction?: () => void;
};

const POPUP_OPTIONS = {
  className: 'ice-map-popup-shell',
  maxWidth: 288,
  minWidth: 220,
  autoPan: true,
  closeButton: true,
} as const;

function popupText(className: string, text: string) {
  const element = document.createElement('p');
  element.className = className;
  element.textContent = text;
  return element;
}

function popupAction(label: string, onClick: () => void) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ice-map-popup__action';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function popupDocumentationLink(onClick: () => void) {
  const link = document.createElement('a');
  link.href = '#ice-case-documentation';
  link.className = 'ice-map-popup__link';
  link.textContent = 'How this is documented';
  link.addEventListener('click', onClick);
  return link;
}

function buildCityPopup(
  city: CityPoint,
  map: LeafletMap,
  onCitySelect: (city: CityPoint) => void,
  snapshot: HeatmapSnapshot
) {
  const root = document.createElement('div');
  root.className = 'ice-map-popup';
  root.append(
    popupText('ice-map-popup__kicker', 'City total'),
    popupText('ice-map-popup__title', `${city.city}, ${city.stateCode}`),
    popupText('ice-map-popup__count', `${formatNumber(city.count)} records`),
    popupText(
      'ice-map-popup__rank',
      `#${formatNumber(
        Math.max(1, cityRank(city, snapshot.cities))
      )} city total · ${citySharePercent(
        city,
        snapshot.meta.mappedRecords
      )}% of mapped records`
    ),
    popupText(
      'ice-map-popup__note',
      'A city-level total, not a case file. Each record represents a person whose identity is not in this release.'
    ),
    popupAction('Open context brief', () => {
      map.closePopup();
      onCitySelect(city);
    }),
    popupDocumentationLink(() => map.closePopup())
  );
  return root;
}

function buildClusterPopup(
  cluster: CityCluster,
  map: LeafletMap,
  zoom: number,
  onCitySelect: (city: CityPoint) => void,
  snapshot: HeatmapSnapshot
) {
  const root = document.createElement('div');
  root.className = 'ice-map-popup';
  const nextZoom = Math.min(MAX_INDIVIDUAL_ZOOM, Math.max(9, zoom + 2));
  const singleCity = cluster.cityCount === 1 ? cluster.cities[0] : null;

  if (singleCity) {
    root.append(
      popupText('ice-map-popup__kicker', 'City total'),
      popupText('ice-map-popup__title', `${singleCity.city}, ${singleCity.stateCode}`),
      popupText('ice-map-popup__count', `${formatNumber(singleCity.count)} records`),
      popupText(
        'ice-map-popup__rank',
        `#${formatNumber(
          Math.max(1, cityRank(singleCity, snapshot.cities))
        )} city total · ${citySharePercent(
          singleCity,
          snapshot.meta.mappedRecords
        )}% of mapped records`
      ),
      popupText(
        'ice-map-popup__note',
        'A city-level total, not a case file. Each record represents a person whose identity is not in this release.'
      ),
      popupAction('Open context brief', () => {
        map.closePopup();
        onCitySelect(singleCity);
        map.flyTo([singleCity.lat, singleCity.lng], nextZoom, { duration: 0.45 });
      }),
      popupDocumentationLink(() => map.closePopup())
    );
    return root;
  }

  root.append(
    popupText('ice-map-popup__kicker', 'City cluster'),
    popupText(
      'ice-map-popup__title',
      `${formatNumber(cluster.cityCount)} nearby cities`
    ),
    popupText('ice-map-popup__count', `${formatNumber(cluster.records)} records combined`),
    popupText('ice-map-popup__rank', 'Grouped at this map scale'),
    popupText(
      'ice-map-popup__note',
      'Zoom in to separate these city totals, then open a city dot for its context brief.'
    ),
    popupAction('Zoom in', () => {
      map.closePopup();
      map.flyTo([cluster.lat, cluster.lng], nextZoom, { duration: 0.45 });
    }),
    popupDocumentationLink(() => map.closePopup())
  );
  return root;
}

/**
 * The Leaflet map, its city circle layer and its three marker layers.
 *
 * The map is created once and kept for the lifetime of the page; every other
 * effect reacts to `mapGeneration` so it only touches a map that exists.
 */
export function useIceMap({
  snapshot,
  selectedCity,
  searchTarget,
  userLocation,
  userLocationRef,
  shouldFocusUser,
  allowAutoFocus,
  initialView,
  initialMapView,
  onCitySelect,
  onMapInteraction,
}: UseIceMapOptions) {
  const [mapView, setMapView] = useState<MapView>(initialMapView);
  const [mapViewport, setMapViewport] = useState<MapViewport | null>(initialView);
  const [mapGeneration, setMapGeneration] = useState(0);
  const [heatStatus, setHeatStatus] = useState<HeatStatus>('loading');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const cityLayerRef = useRef<LayerGroup | null>(null);
  const selectedLayerRef = useRef<LayerGroup | null>(null);
  const searchLayerRef = useRef<LayerGroup | null>(null);
  const userLayerRef = useRef<LayerGroup | null>(null);
  const initialViewRef = useRef(initialView);
  const onMapInteractionRef = useRef(onMapInteraction);

  useEffect(() => {
    onMapInteractionRef.current = onMapInteraction;
  }, [onMapInteraction]);

  useEffect(() => {
    if (
      !allowAutoFocus.current ||
      !userLocation ||
      mapGeneration === 0 ||
      !shouldFocusUser.current
    ) {
      return;
    }
    const map = mapRef.current;
    if (!map) return;

    shouldFocusUser.current = false;
    setMapView('local');
    map.flyTo(
      [userLocation.lat, userLocation.lng],
      userLocation.precision === 'precise' ? PRECISE_ZOOM : APPROXIMATE_ZOOM,
      { duration: 0.7 }
    );
  }, [allowAutoFocus, mapGeneration, userLocation, shouldFocusUser]);

  useEffect(() => {
    let disposed = false;
    let map: LeafletMap | null = null;
    let resizeObserver: ResizeObserver | null = null;

    void (async () => {
      const L = (await import('leaflet')).default;
      if (disposed || !mapContainerRef.current || mapRef.current) return;

      const initialMapViewport = initialViewRef.current;
      map = L.map(mapContainerRef.current, {
        center: initialMapViewport?.center ?? NATIONWIDE_CENTER,
        zoom: initialMapViewport?.zoom ?? NATIONWIDE_ZOOM,
        minZoom: MIN_ZOOM,
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

      cityLayerRef.current = L.layerGroup().addTo(map);
      selectedLayerRef.current = L.layerGroup().addTo(map);
      searchLayerRef.current = L.layerGroup().addTo(map);
      userLayerRef.current = L.layerGroup().addTo(map);

      map.on('moveend', () => {
        if (!map) return;
        const center = map.getCenter();
        const zoom = map.getZoom();
        setMapViewport({ center: [center.lat, center.lng], zoom });

        if (zoom <= 5) {
          setMapView('nationwide');
          return;
        }

        const location = userLocationRef.current;
        setMapView(
          location && map.getBounds().contains([location.lat, location.lng]) ? 'local' : 'free'
        );
      });

      resizeObserver = new ResizeObserver(() => {
        map?.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);

      let interactionReady = false;
      const handleInteraction = () => {
        if (!interactionReady) return;
        shouldFocusUser.current = false;
        map?.closePopup();
        onMapInteractionRef.current?.();
      };

      if (!initialMapViewport) {
        map.fitBounds(NATIONWIDE_BOUNDS, { padding: [24, 24], animate: false });
      }
      map.on('dragstart zoomstart', handleInteraction);
      mapRef.current = map;
      setMapGeneration((generation) => generation + 1);
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
      cityLayerRef.current = null;
      selectedLayerRef.current = null;
      searchLayerRef.current = null;
      userLayerRef.current = null;
    };
  }, [userLocationRef, shouldFocusUser]);

  useEffect(() => {
    if (mapGeneration === 0) return;
    let disposed = false;
    let removeMoveEnd: (() => void) | null = null;
    let removePopupListeners: (() => void) | null = null;
    let suppressPopupMove = false;
    setHeatStatus('loading');

    void (async () => {
      try {
        const L = (await import('leaflet')).default;
        if (disposed) return;

        const map = mapRef.current;
        const layer = cityLayerRef.current;
        if (!map || !layer) return;

        const handlePopupOpen = () => {
          // Leaflet auto-pans a popup that would otherwise be clipped. Ignore
          // that one moveend so it does not tear down the popup it belongs to.
          suppressPopupMove = true;
        };
        const handlePopupClose = () => {
          suppressPopupMove = false;
        };
        map.on('popupopen', handlePopupOpen);
        map.on('popupclose', handlePopupClose);
        removePopupListeners = () => {
          map.off('popupopen', handlePopupOpen);
          map.off('popupclose', handlePopupClose);
        };

        const renderCities = () => {
          if (disposed) return;
          if (suppressPopupMove) {
            suppressPopupMove = false;
            return;
          }
          layer.clearLayers();

          const zoom = map.getZoom();
          const bounds = map.getBounds().pad(0.12);
          // Draw larger totals last so an overlapping one-record point cannot
          // steal the click from the city most readers are trying to inspect.
          const visible = snapshot.cities
            .filter((city) => bounds.contains([city.lat, city.lng]))
            .sort((a, b) => a.count - b.count);

          if (visible.length === 0) {
            setHeatStatus('ready');
            return;
          }

          const cellSize = clusterCellSize(zoom);

          if (cellSize === 0) {
            const maxCount = snapshot.meta.maxCityCount;
            for (const city of visible) {
              const marker = L.circleMarker([city.lat, city.lng], {
                ...CITY_CIRCLE_STYLE,
                // A one-record city is still a clickable point; the visual
                // radius can be tiny, but the hit target should not be.
                radius: Math.max(cityCircleRadius(city.count, maxCount), 4),
                interactive: true,
              }).addTo(layer);

              marker.bindTooltip(
                `${selectedCityLabel(city)} · ${formatNumber(city.count)} records`,
                { direction: 'top', offset: [0, -4] }
              );
              marker.bindPopup(
                buildCityPopup(city, map, onCitySelect, snapshot),
                POPUP_OPTIONS
              );
              marker.on('popupopen', () => {
                setMapView('free');
                onCitySelect(city);
              });
            }
            setHeatStatus('ready');
            return;
          }

          const clusters = clusterCityPoints(
            visible,
            (city) => map.project([city.lat, city.lng], zoom),
            cellSize
          );

          for (const cluster of clusters) {
            const size = Math.round(
              clusterIconSize(cluster.records, snapshot.meta.mappedRecords)
            );
            const marker = L.marker([cluster.lat, cluster.lng], {
              icon: L.divIcon({
                className: 'ice-cluster-icon',
                html: `<span class="ice-cluster" style="font-size:${
                  size >= 32 ? 10 : 9
                }px" aria-hidden="true">${formatCompactCount(cluster.records)}</span>`,
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
              }),
              keyboard: false,
            }).addTo(layer);

            marker.bindTooltip(
              `${formatNumber(cluster.records)} records across ${formatNumber(
                cluster.cityCount
              )} ${cluster.cityCount === 1 ? 'city' : 'cities'}. Open for details.`,
              { direction: 'top', offset: [0, -size / 2] }
            );
            marker.bindPopup(
              buildClusterPopup(cluster, map, zoom, onCitySelect, snapshot),
              POPUP_OPTIONS
            );
            marker.getElement()?.setAttribute('aria-hidden', 'true');
          }

          setHeatStatus('ready');
        };

        renderCities();
        map.on('moveend', renderCities);
        removeMoveEnd = () => map.off('moveend', renderCities);
      } catch (error) {
        console.error('Unable to render the ICE arrest city clusters', error);
        if (!disposed) setHeatStatus('error');
      }
    })();

    return () => {
      disposed = true;
      removeMoveEnd?.();
      removePopupListeners?.();
      cityLayerRef.current?.clearLayers();
    };
  }, [mapGeneration, onCitySelect, snapshot]);

  useEffect(() => {
    if (mapGeneration === 0) return;
    let disposed = false;

    void (async () => {
      const L = (await import('leaflet')).default;
      if (disposed) return;
      const layer = selectedLayerRef.current;
      if (!layer) return;

      layer.clearLayers();
      if (!selectedCity) return;

      L.marker([selectedCity.lat, selectedCity.lng], {
        icon: L.divIcon({
          className: 'ice-selected-city',
          html: '<span aria-hidden="true"></span>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        interactive: false,
        keyboard: false,
      })
        .bindTooltip(
          `${selectedCityLabel(selectedCity)}: ${formatNumber(selectedCity.count)} records`,
          { direction: 'top', offset: [0, -8] }
        )
        .addTo(layer);
    })();

    return () => {
      disposed = true;
    };
  }, [mapGeneration, selectedCity]);

  useEffect(() => {
    if (!searchTarget) {
      searchLayerRef.current?.clearLayers();
      return;
    }
    if (mapGeneration === 0) return;
    let disposed = false;

    void (async () => {
      const L = (await import('leaflet')).default;
      if (disposed) return;
      const layer = searchLayerRef.current;
      if (!layer) return;

      layer.clearLayers();
      const icon = L.divIcon({
        className: 'ice-map-search-target',
        html: '<span class="ice-map-search-pin" aria-hidden="true"></span>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([searchTarget.lat, searchTarget.lng], {
        icon,
        interactive: false,
        keyboard: false,
      }).addTo(layer);
      marker.getElement()?.setAttribute('aria-hidden', 'true');
    })();

    return () => {
      disposed = true;
    };
  }, [mapGeneration, searchTarget]);

  useEffect(() => {
    if (mapGeneration === 0) return;
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
          approximate
            ? `Approximate area: ${userLocation.label}`
            : 'Your current location',
          { direction: 'top', offset: [0, -12] }
        )
        .addTo(layer);

      marker.getElement()?.setAttribute('aria-hidden', 'true');
    })();

    return () => {
      disposed = true;
    };
  }, [mapGeneration, userLocation]);

  const zoomMap = (direction: 'in' | 'out') => {
    shouldFocusUser.current = false;
    allowAutoFocus.current = false;
    mapRef.current?.closePopup();
    if (direction === 'in') mapRef.current?.zoomIn();
    else mapRef.current?.zoomOut();
  };

  const flyToCity = (city: CityPoint) => {
    shouldFocusUser.current = false;
    allowAutoFocus.current = false;
    const map = mapRef.current;
    if (map) {
      map.flyTo([city.lat, city.lng], Math.max(map.getZoom(), CITY_FOCUS_ZOOM), {
        duration: 0.5,
      });
    }
  };

  const flyToUsOverview = () => {
    const map = mapRef.current;
    if (!map) return;
    shouldFocusUser.current = false;
    allowAutoFocus.current = false;
    map.fitBounds(NATIONWIDE_BOUNDS, { padding: [24, 24], duration: 0.4 });
  };

  const flyToUser = (location: UserLocation) => {
    const map = mapRef.current;
    if (!map) return;
    shouldFocusUser.current = false;
    allowAutoFocus.current = true;
    map.flyTo(
      [location.lat, location.lng],
      location.precision === 'precise' ? PRECISE_ZOOM : APPROXIMATE_ZOOM,
      { duration: 0.6 }
    );
  };

  return {
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
  };
}
