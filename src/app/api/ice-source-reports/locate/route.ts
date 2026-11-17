import { connection, NextResponse } from 'next/server';
import { isUsPoint } from '@/lib/geo/us-boundary';
import {
  exactSourceReportPlace,
  nearestSourceReportPlace,
  sourceReportPlaceKey,
  type SourceReportPlacePoint,
} from '@/lib/ice-source-report-location';
import { normalizeIceSourceReportCity } from '@/lib/ice-source-report-search';
import { getIceHeatmapSnapshot } from '@/lib/queries/ice-heatmap';
import { getSourceReportPlaces } from '@/lib/queries/ice-source-report-places';
import { US_STATE_CODES } from '@/lib/rapid-city-match';

export const maxDuration = 20;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
};

const NO_STORE_HEADERS = {
  ...CORS,
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

type LocateResponse =
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

function respond(body: LocateResponse, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS,
  });
}

function readState(value: string | null) {
  const stateCode = value?.trim().toUpperCase() ?? '';
  return US_STATE_CODES.has(stateCode) ? stateCode : '';
}

/**
 * Resolve a coordinate to the nearest city that actually has published source
 * reports. The response never includes a report coordinate, street address, or
 * per-report location; only the public city-level place and an optional
 * distance are returned.
 *
 * `city` and `state` are optional hints from the place search. A matching
 * city is returned directly even when it is absent from the heat-map city
 * snapshot, so a small source-stated place remains selectable.
 */
export async function GET(request: Request) {
  await connection();

  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    !isUsPoint(lat, lng)
  ) {
    return respond({ available: false, reason: 'outside-us' });
  }

  const stateCode = readState(url.searchParams.get('state'));
  const cityHint = normalizeIceSourceReportCity(url.searchParams.get('city'));

  try {
    const places = await getSourceReportPlaces();

    if (cityHint) {
      const exact = exactSourceReportPlace(places, cityHint, stateCode);
      if (exact) {
        return respond({
          available: true,
          city: exact.city,
          stateCode: exact.stateCode,
          reportCount: exact.count,
          exact: true,
          distanceMiles: null,
        });
      }
    }

    if (places.length === 0) {
      return respond({ available: false, reason: 'no-reports' });
    }

    const snapshot = await getIceHeatmapSnapshot();
    const points = new Map<string, { lat: number; lng: number }>();
    for (const point of snapshot.cities) {
      const key = sourceReportPlaceKey(point.city, point.stateCode);
      if (!points.has(key)) points.set(key, { lat: point.lat, lng: point.lng });
    }

    const candidates: SourceReportPlacePoint[] = [];
    for (const place of places) {
      if (stateCode && place.stateCode !== stateCode) continue;
      const point = points.get(sourceReportPlaceKey(place.city, place.stateCode));
      if (!point) continue;
      candidates.push({ ...place, ...point });
    }

    const nearest = nearestSourceReportPlace(candidates, lat, lng);
    if (!nearest) {
      return respond({ available: false, reason: 'no-reports' });
    }

    return respond({
      available: true,
      city: nearest.place.city,
      stateCode: nearest.place.stateCode,
      reportCount: nearest.place.count,
      exact: false,
      distanceMiles: Math.round(nearest.distanceMiles),
    });
  } catch {
    return respond({ available: false, reason: 'unavailable' }, 503);
  }
}
