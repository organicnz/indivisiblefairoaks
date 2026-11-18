import { isUsPoint } from '@/lib/geo/us-boundary';
import {
  DEFAULT_RAPID_FILTERS,
  type RapidFilters,
  type RapidKindFilter,
  type RapidStatusFilter,
  type RapidTimeFilter,
} from './rapid-alert-utils';
import { MAX_ZOOM, MIN_ZOOM, NATIONWIDE_ZOOM } from './constants';
import type { RapidUrlState } from './rapid-types';
import type { MapViewport } from './types';

const ALERT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,96}$/i;
const STATE_CODE_PATTERN = /^[A-Z]{2}$/;
const QUERY_MAX_LENGTH = 80;

type SearchParamsLike = URLSearchParams | Record<string, string | string[] | undefined>;

export const RAPID_URL_KEYS = [
  'lat',
  'lng',
  'z',
  'alert',
  'fq',
  'fk',
  'fs',
  'fst',
  'ft',
] as const;

const KIND_FILTERS: readonly RapidKindFilter[] = [
  'all',
  'enforcement',
  'detention',
  'checkpoint',
];
const STATUS_FILTERS: readonly RapidStatusFilter[] = ['all', 'source-confirmed', 'sighting'];
const TIME_FILTERS: readonly RapidTimeFilter[] = ['live', '24h', 'all'];

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

function oneOf<T extends string>(values: readonly T[], candidate: string | null, fallback: T): T {
  const normalized = candidate?.trim() ?? '';
  return normalized && (values as readonly string[]).includes(normalized)
    ? (normalized as T)
    : fallback;
}

function parseFilters(params: SearchParamsLike): RapidFilters {
  const rawState = readParam(params, 'fst')?.trim().toUpperCase() ?? '';

  return {
    query: (readParam(params, 'fq') ?? '').trim().slice(0, QUERY_MAX_LENGTH),
    kind: oneOf(KIND_FILTERS, readParam(params, 'fk'), DEFAULT_RAPID_FILTERS.kind),
    status: oneOf(STATUS_FILTERS, readParam(params, 'fs'), DEFAULT_RAPID_FILTERS.status),
    stateCode: STATE_CODE_PATTERN.test(rawState) ? rawState : '',
    time: oneOf(TIME_FILTERS, readParam(params, 'ft'), DEFAULT_RAPID_FILTERS.time),
  };
}

export function parseRapidUrlState(params: SearchParamsLike): RapidUrlState {
  const lat = readNumber(params, 'lat');
  const lng = readNumber(params, 'lng');
  const parsedZoom = readNumber(params, 'z');
  const rawAlert = readParam(params, 'alert')?.trim() ?? '';
  const initialAlertId = ALERT_ID_PATTERN.test(rawAlert) ? rawAlert : null;
  const initialFilters = parseFilters(params);

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
    initialFilters,
    hasUrlState: Boolean(initialView || initialAlertId),
  };
}

function formatCoordinate(value: number) {
  return String(Number(value.toFixed(5)));
}

function formatZoom(value: number) {
  return String(Number(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)).toFixed(2)));
}

/**
 * Filters use a separate `f*` namespace so rapid-feed query state cannot
 * collide with the historical FOIA module's legacy `q` parameter. The filter
 * text is public search text, never device location.
 */
function writeFilters(params: URLSearchParams, filters: RapidFilters) {
  const query = filters.query.trim().slice(0, QUERY_MAX_LENGTH);
  if (query) params.set('fq', query);
  if (filters.kind !== 'all') params.set('fk', filters.kind);
  if (filters.status !== 'all') params.set('fs', filters.status);
  if (STATE_CODE_PATTERN.test(filters.stateCode)) params.set('fst', filters.stateCode);
  if (filters.time !== 'all') params.set('ft', filters.time);
}

export function serializeRapidUrlState(
  base: URLSearchParams,
  state: {
    viewport: MapViewport | null;
    mapView: 'nationwide' | 'local' | 'free';
    selectedAlertId: string | null;
    filters?: RapidFilters;
  }
): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const key of RAPID_URL_KEYS) params.delete(key);

  writeFilters(params, state.filters ?? DEFAULT_RAPID_FILTERS);

  // Never put a user-derived map view into a shareable URL. Filters are public
  // search state, so they remain shareable even when the map is user-derived.
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
