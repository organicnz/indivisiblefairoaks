import type { MapView } from './types';

export const TOP_CITY_LIMIT = 12;

export const NATIONWIDE_BOUNDS: [[number, number], [number, number]] = [
  [24.4, -125],
  [49.4, -66.9],
];
export const MIN_ZOOM = 3;
export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
export const LOCATION_SEARCH_ZOOM = 12;
export const LOCATION_CACHE_LIMIT = 24;
export const GEO_ENDPOINT = '/api/geo';
export const APPROXIMATE_ZOOM = 7;
export const PRECISE_ZOOM = 11;
export const GEOLOCATION_TIMEOUT_MS = 8_000;
export const APPROXIMATE_TIMEOUT_MS = 4_000;

export const MAP_VIEW_COPY: Record<MapView, { heading: string; description: string; status: string }> =
  {
    nationwide: {
      heading: 'U.S. overview',
      description:
        'The map opens over the U.S.; clusters group nearby cities at overview zooms. Pan or zoom anywhere, including Alaska, Hawaii, and Puerto Rico, or center on your approximate area.',
      status: 'U.S. overview',
    },
    local: {
      heading: 'Your area',
      description:
        'Centered on your approximate or device location. Clusters and circles remain a published historical snapshot.',
      status: 'Your area',
    },
    free: {
      heading: 'Custom U.S. view',
      description:
        'A custom view. Search for a place, select a city, or tap a cluster to zoom in.',
      status: 'Custom U.S. view',
    },
  };
