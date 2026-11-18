import { isUsPoint } from '@/lib/geo/us-boundary';
import {
  CITY_FOCUS_ZOOM,
  LOCATION_SEARCH_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  NATIONWIDE_ZOOM,
} from './constants';
import { cityKey } from './data';
import type { CityPoint, MapView, MapViewport, SearchTarget } from './types';

/**
 * URL state is a view codec, never a data channel.
 *
 * A shared link may select an existing city from the Supabase snapshot, drop a
 * search pin at a U.S. point, and restore the map viewport. Counts, records,
 * names, reports, and user-location data are not accepted from the URL and are
 * never written to it. `city` is resolved by key against the supplied snapshot,
 * so a crafted query string cannot invent a city or change a total.
 *
 * The optional key prefix lets the embedded historical map keep its state next
 * to the rapid-response map on the same page. Rapid state owns `lat`/`lng`/`z`;
 * the historical module writes `foiaLat`/`foiaLng`/`foiaZ`, and so on.
 */
const MAX_CITY_NAME_LENGTH = 120;
const MAX_LABEL_LENGTH = 180;
const MAX_QUERY_LENGTH = 120;
const PIN_PATTERN = /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/;

export const ICE_MAP_URL_KEYS = [
  'city',
  'state',
  'pin',
  'pinLabel',
  'q',
  'lat',
  'lng',
  'z',
] as const;

const LEGACY_HISTORY_KEYS = ['city', 'state', 'pin', 'pinLabel', 'q'] as const;

export type IceMapUrlOptions = {
  /** Prefix applied to every map view key, e.g. `foia` → `foiaCity`. */
  keyPrefix?: string;
  /** Read unprefixed keys as a fallback for links created before the module moved. */
  includeUnprefixed?: boolean;
};

export type IceMapUrlState = {
  selectedCity: CityPoint | null;
  searchTarget: SearchTarget | null;
  searchQuery: string;
  initialView: MapViewport | null;
  initialMapView: MapView;
  hasUrlState: boolean;
};

export type IceMapUrlWriteState = {
  selectedCity: CityPoint | null;
  searchTarget: SearchTarget | null;
  searchQuery: string;
  viewport: MapViewport | null;
  mapView: MapView;
};

type SearchParamsLike = URLSearchParams | Record<string, string | string[] | undefined>;
type ParamReader = (key: string) => string | null;

function readParam(params: SearchParamsLike, key: string): string | null {
  if (typeof (params as URLSearchParams).get === 'function') {
    return (params as URLSearchParams).get(key);
  }

  const value = (params as Record<string, string | string[] | undefined>)[key];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function normalizePrefix(prefix: string | undefined): string {
  return prefix?.trim() ?? '';
}

function prefixedKey(prefix: string, key: string): string {
  if (!prefix) return key;
  return `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

function createParamReader(
  params: SearchParamsLike,
  options: IceMapUrlOptions
): ParamReader {
  const prefix = normalizePrefix(options.keyPrefix);

  return (key) => {
    const value = readParam(params, prefixedKey(prefix, key));
    if (value !== null) return value;
    if (prefix && options.includeUnprefixed) return readParam(params, key);
    return null;
  };
}

function readText(
  read: ParamReader,
  key: string,
  maxLength: number
): string | null {
  const value = read(key)?.trim();
  if (!value) return null;
  return value.slice(0, maxLength);
}

function readNumber(read: ParamReader, key: string): number | null {
  const value = read(key)?.trim();
  if (!value) return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseCity(
  read: ParamReader,
  citiesByKey: ReadonlyMap<string, CityPoint>
): CityPoint | null {
  const cityName = readText(read, 'city', MAX_CITY_NAME_LENGTH);
  const stateCode = readText(read, 'state', 2)?.toUpperCase();
  if (!cityName || !stateCode || !/^[A-Z]{2}$/.test(stateCode)) return null;

  return citiesByKey.get(`${cityName.toLowerCase()}|${stateCode.toLowerCase()}`) ?? null;
}

function parseSearchTarget(read: ParamReader): SearchTarget | null {
  const pin = readText(read, 'pin', 64);
  if (!pin || !PIN_PATTERN.test(pin)) return null;

  const [latText, lngText] = pin.split(',');
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isUsPoint(lat, lng)) {
    return null;
  }

  const label =
    readText(read, 'pinLabel', MAX_LABEL_LENGTH) ??
    readText(read, 'q', MAX_QUERY_LENGTH) ??
    'Shared map location';

  return { lat, lng, label };
}

function parseViewport(read: ParamReader): MapViewport | null {
  const lat = readNumber(read, 'lat');
  const lng = readNumber(read, 'lng');
  if (lat === null || lng === null || !isUsPoint(lat, lng)) return null;

  const parsedZoom = readNumber(read, 'z');
  const zoom =
    parsedZoom === null
      ? NATIONWIDE_ZOOM
      : Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, parsedZoom));

  return { center: [lat, lng], zoom };
}

function formatCoordinate(value: number): string {
  return String(Number(value.toFixed(5)));
}

function formatZoom(value: number): string {
  const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  return String(Number(clamped.toFixed(2)));
}

function trimText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

/**
 * Read view state from a page URL.
 *
 * Invalid city keys and non-U.S. coordinates are ignored rather than coerced;
 * a URL with no recognized view state returns `hasUrlState: false`, leaving the
 * map's normal default and location behavior untouched.
 */
export function parseIceMapUrlState(
  params: SearchParamsLike,
  cities: readonly CityPoint[],
  options: IceMapUrlOptions = {}
): IceMapUrlState {
  const read = createParamReader(params, options);
  const citiesByKey = new Map(
    cities.map((city) => [cityKey(city).toLowerCase(), city] as const)
  );
  const selectedCity = parseCity(read, citiesByKey);
  const searchTarget = parseSearchTarget(read);
  const explicitView = parseViewport(read);
  const initialView =
    explicitView ??
    (selectedCity
      ? {
          center: [selectedCity.lat, selectedCity.lng] as [number, number],
          zoom: CITY_FOCUS_ZOOM,
        }
      : searchTarget
        ? {
            center: [searchTarget.lat, searchTarget.lng] as [number, number],
            zoom: LOCATION_SEARCH_ZOOM,
          }
        : null);
  const initialMapView: MapView = initialView
    ? initialView.zoom <= 5
      ? 'nationwide'
      : 'free'
    : 'nationwide';
  const searchQuery = searchTarget
    ? (readText(read, 'q', MAX_QUERY_LENGTH) ??
      trimText(searchTarget.label, MAX_QUERY_LENGTH))
    : '';

  return {
    selectedCity,
    searchTarget,
    searchQuery,
    initialView,
    initialMapView,
    hasUrlState: Boolean(selectedCity || searchTarget || initialView),
  };
}

/**
 * Write view state into a query string while preserving unrelated parameters.
 *
 * A local map view is deliberately never serialized: centering on a user's
 * approximate or precise area must not leak that location into a shareable URL.
 */
export function serializeIceMapUrlState(
  base: URLSearchParams,
  state: IceMapUrlWriteState,
  options: IceMapUrlOptions = {}
): URLSearchParams {
  const prefix = normalizePrefix(options.keyPrefix);
  const params = new URLSearchParams(base);
  for (const key of ICE_MAP_URL_KEYS) {
    params.delete(prefixedKey(prefix, key));
  }
  if (prefix) {
    // Migrate links made by the old standalone historical view. Do not remove
    // unprefixed lat/lng/z: those belong to the rapid-response map.
    for (const key of LEGACY_HISTORY_KEYS) params.delete(key);
  }

  if (state.mapView === 'local') return params;

  if (state.selectedCity) {
    params.set(
      prefixedKey(prefix, 'city'),
      state.selectedCity.city
    );
    params.set(
      prefixedKey(prefix, 'state'),
      state.selectedCity.stateCode
    );
  }

  if (state.searchTarget) {
    params.set(
      prefixedKey(prefix, 'pin'),
      `${formatCoordinate(state.searchTarget.lat)},${formatCoordinate(
        state.searchTarget.lng
      )}`
    );

    const label =
      trimText(state.searchTarget.label, MAX_LABEL_LENGTH) || 'Shared map location';
    params.set(prefixedKey(prefix, 'pinLabel'), label);

    const query = trimText(state.searchQuery, MAX_QUERY_LENGTH) || label;
    if (query) params.set(prefixedKey(prefix, 'q'), query);
  }

  if (state.viewport) {
    params.set(prefixedKey(prefix, 'lat'), formatCoordinate(state.viewport.center[0]));
    params.set(prefixedKey(prefix, 'lng'), formatCoordinate(state.viewport.center[1]));
    params.set(prefixedKey(prefix, 'z'), formatZoom(state.viewport.zoom));
  }

  return params;
}
