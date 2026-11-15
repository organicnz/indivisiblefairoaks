import { connection, NextResponse } from 'next/server';
import { isUsPoint } from '@/lib/geo/us-boundary';

type ApproximateGeoResponse =
  | {
      available: true;
      lat: number;
      lng: number;
      label: string;
      precision: 'approximate';
      source: 'vercel-ip';
    }
  | {
      available: false;
      reason: 'outside-us' | 'unavailable';
    };

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: [
    'x-vercel-ip-city',
    'x-vercel-ip-country',
    'x-vercel-ip-country-region',
    'x-vercel-ip-latitude',
    'x-vercel-ip-longitude',
  ].join(', '),
};

/**
 * Translate Vercel's coarse IP geolocation headers into a map starting point.
 *
 * This deliberately returns only a city/region label and an approximate
 * coordinate. It never returns the client IP, never reads a cookie, and never
 * stores the request. The client can use this when browser geolocation is
 * unavailable or permission is declined.
 */
export async function GET(request: Request) {
  await connection();

  const country = request.headers.get('x-vercel-ip-country')?.toUpperCase() ?? '';
  const rawLat = request.headers.get('x-vercel-ip-latitude');
  const rawLng = request.headers.get('x-vercel-ip-longitude');

  // Local development and non-Vercel hosts do not provide these headers.
  if (!rawLat || !rawLng) {
    return respond({ available: false, reason: 'unavailable' });
  }

  const lat = Number(rawLat);
  const lng = Number(rawLng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isUsPoint(lat, lng)) {
    return respond({
      available: false,
      reason: country && country !== 'US' && country !== 'PR' ? 'outside-us' : 'unavailable',
    });
  }

  const city = cleanHeader(request.headers.get('x-vercel-ip-city'));
  const region = cleanHeader(request.headers.get('x-vercel-ip-country-region'));
  const label = city && region ? `${city}, ${region}` : city || region || 'your area';

  return respond({
    available: true,
    lat: Number(lat.toFixed(4)),
    lng: Number(lng.toFixed(4)),
    label,
    precision: 'approximate',
    source: 'vercel-ip',
  });
}

function respond(body: ApproximateGeoResponse) {
  return NextResponse.json(body, {
    headers: NO_STORE_HEADERS,
    status: 200,
  });
}

function cleanHeader(value: string | null): string {
  if (!value) return '';

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // A malformed header should not fail the map.
  }

  return decoded
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}
