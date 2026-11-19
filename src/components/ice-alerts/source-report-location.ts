import { isUsPoint } from '@/lib/geo/us-boundary';
import { fetchWithTimeout } from '@/lib/service-fetch';
import { GEOLOCATION_TIMEOUT_MS } from './constants';
import { US_STATE_OPTIONS } from './us-state-options';

const STATE_CODES = new Set(US_STATE_OPTIONS.map((state) => state.code));

export type LocateResponse =
  | {
      available: true;
      city: string;
      stateCode: string;
      reportCount: number;
      exact: boolean;
      distanceMiles: number | null;
    }
  | {
      available: false;
      reason: 'outside-us' | 'no-reports' | 'unavailable';
    };

export type PickerStatus =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'searching' }
  | { kind: 'message'; tone: 'success' | 'error'; text: string };

export type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  suburb?: string;
  county?: string;
  state?: string;
  'ISO3166-2-lvl4'?: string;
};

export type NominatimPlace = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: NominatimAddress;
};

export function statusForReason(reason: Extract<LocateResponse, { available: false }>['reason']) {
  if (reason === 'outside-us') {
    return 'That location appears outside the U.S. Try a U.S. city or ZIP code.';
  }
  if (reason === 'no-reports') {
    return 'No collected reports match that place yet. Try a broader area or the nationwide archive.';
  }
  return 'Location lookup is temporarily unavailable. Search a city or ZIP instead.';
}

export function isLocateResponse(value: unknown): value is LocateResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;

  if (candidate.available === true) {
    return (
      typeof candidate.city === 'string' &&
      candidate.city.length > 0 &&
      typeof candidate.stateCode === 'string' &&
      candidate.stateCode.length === 2 &&
      typeof candidate.reportCount === 'number' &&
      Number.isFinite(candidate.reportCount) &&
      typeof candidate.exact === 'boolean' &&
      (candidate.distanceMiles === null ||
        (typeof candidate.distanceMiles === 'number' && Number.isFinite(candidate.distanceMiles)))
    );
  }

  return (
    candidate.available === false &&
    (candidate.reason === 'outside-us' ||
      candidate.reason === 'no-reports' ||
      candidate.reason === 'unavailable')
  );
}

export function approximateCoordinates(value: unknown): { lat: number; lng: number } | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.available !== true) return null;

  const lat = Number(candidate.lat);
  const lng = Number(candidate.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isUsPoint(lat, lng)) {
    return null;
  }
  return { lat, lng };
}

export function stateCodeFromAddress(address?: NominatimAddress) {
  const iso = address?.['ISO3166-2-lvl4'];
  if (typeof iso === 'string' && /^US-[A-Z]{2}$/i.test(iso)) {
    const code = iso.slice(3).toUpperCase();
    if (STATE_CODES.has(code)) return code;
  }

  const stateName = address?.state?.trim().toLowerCase();
  if (!stateName) return '';
  return US_STATE_OPTIONS.find((state) => state.name.toLowerCase() === stateName)?.code ?? '';
}

export function cityFromAddress(address?: NominatimAddress) {
  if (!address) return '';
  for (const key of [
    'city',
    'town',
    'village',
    'hamlet',
    'municipality',
    'suburb',
    'county',
  ] as const) {
    const value = address[key]?.trim();
    if (value) return value;
  }
  return '';
}

export function stateLabel(stateCode: string) {
  if (!stateCode) return '';
  return US_STATE_OPTIONS.find((state) => state.code === stateCode)?.name ?? stateCode;
}

export function readBrowserPosition(signal: AbortSignal): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is unavailable'));
      return;
    }

    let settled = false;
    const abort = () => {
      if (settled) return;
      settled = true;
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', abort);
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', abort);
        reject(error);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 300_000,
        timeout: GEOLOCATION_TIMEOUT_MS,
      }
    );
  });
}

export async function requestLocate(
  lat: number,
  lng: number,
  hints: { city?: string; stateCode?: string },
  signal: AbortSignal
): Promise<LocateResponse> {
  const params = new URLSearchParams({
    lat: lat.toFixed(5),
    lng: lng.toFixed(5),
  });
  if (hints.city) params.set('city', hints.city);
  if (hints.stateCode) params.set('state', hints.stateCode);

  const response = await fetchWithTimeout(
    `/api/ice-source-reports/locate?${params.toString()}`,
    {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal,
    },
    10_000
  );

  if (!response.ok) return { available: false, reason: 'unavailable' };

  const payload: unknown = await response.json();
  return isLocateResponse(payload) ? payload : { available: false, reason: 'unavailable' };
}
