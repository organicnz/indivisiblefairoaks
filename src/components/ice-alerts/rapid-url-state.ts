import { isUsPoint } from '@/lib/geo/us-boundary';
import { MAX_ZOOM, MIN_ZOOM, NATIONWIDE_ZOOM } from './constants';
import type { RapidUrlState } from './rapid-types';
import type { MapViewport } from './types';

const ALERT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,96}$/i;

type SearchParamsLike = URLSearchParams | Record<string, string | string[] | undefined>;

export const RAPID_URL_KEYS = ['lat', 'lng', 'z', 'alert'] as const;

function readParam(params: SearchParamsLike, key: string): string | null {
  if (typeof (params as URLSearchParams).get === 'function') {
    return (params as URLSearchParams).get(key);
  }

  const value = (params as Record<string, string | string[] | undefined>)[key];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function readNumber(params: SearchParamsLike, key: string) {
  const value = readParam(params, key)?.trim();
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function parseRapidUrlState(params: SearchParamsLike): RapidUrlState {
  const lat = readNumber(params, 'lat');
  const lng = readNumber(params, 'lng');
  const parsedZoom = readNumber(params, 'z');
  const rawAlert = readParam(params, 'alert')?.trim() ?? '';
  const initialAlertId = ALERT_ID_PATTERN.test(rawAlert) ? rawAlert : null;

  let initialView: MapViewport | null = null;
  if (lat !== null && lng !== null && isUsPoint(lat, lng)) {
    initialView = {
      center: [lat, lng],
      zoom:
        parsedZoom === null
          ? NATIONWIDE_ZOOM
          : Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, parsedZoom)),
    };
  }

  return {
    initialView,
    initialMapView: initialView
      ? initialView.zoom <= 5
        ? 'nationwide'
        : 'free'
      : 'nationwide',
    initialAlertId,
    hasUrlState: Boolean(initialView || initialAlertId),
  };
}

function formatCoordinate(value: number) {
  return String(Number(value.toFixed(5)));
}

function formatZoom(value: number) {
  return String(Number(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)).toFixed(2)));
}

export function serializeRapidUrlState(
  base: URLSearchParams,
  state: {
    viewport: MapViewport | null;
    mapView: 'nationwide' | 'local' | 'free';
    selectedAlertId: string | null;
  }
): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const key of RAPID_URL_KEYS) params.delete(key);

  // Never put a user-derived map view into a shareable URL.
  if (state.mapView === 'local') return params;

  if (state.selectedAlertId && ALERT_ID_PATTERN.test(state.selectedAlertId)) {
    params.set('alert', state.selectedAlertId);
  }

  if (state.viewport) {
    params.set('lat', formatCoordinate(state.viewport.center[0]));
    params.set('lng', formatCoordinate(state.viewport.center[1]));
    params.set('z', formatZoom(state.viewport.zoom));
  }

  return params;
}
