import { distanceMilesBetween } from '@/lib/ice-source-report-location';
import type { RapidMapPoint } from './rapid-types';

export type RapidLocalPoint = RapidMapPoint & {
  distanceMiles: number;
};

/**
 * Rank city-level points by straight-line distance to a user's approximate
 * location. The points already carry city centroids; this never measures to a
 * report address because the map does not retain one.
 */
export function rankRapidPointsByDistance(
  points: readonly RapidMapPoint[],
  lat: number,
  lng: number,
  radiusMiles: number
): RapidLocalPoint[] {
  const limit = Number.isNaN(radiusMiles) ? 100 : Math.max(1, radiusMiles);

  return points
    .map((point) => ({
      ...point,
      distanceMiles: distanceMilesBetween(lat, lng, point.lat, point.lng),
    }))
    .filter(
      (point) => Number.isFinite(point.distanceMiles) && point.distanceMiles <= limit
    )
    .sort(
      (a, b) =>
        a.distanceMiles - b.distanceMiles ||
        Date.parse(b.latestAt) - Date.parse(a.latestAt) ||
        a.place.localeCompare(b.place)
    );
}

export function nearestRapidPoint(
  points: readonly RapidMapPoint[],
  lat: number,
  lng: number
): RapidLocalPoint | null {
  return (
    rankRapidPointsByDistance(points, lat, lng, Number.POSITIVE_INFINITY)[0] ?? null
  );
}

export function formatLocalMiles(distanceMiles: number) {
  if (!Number.isFinite(distanceMiles)) return 'Distance unavailable';
  if (distanceMiles < 1) return '<1 mi';
  return `${Math.round(distanceMiles).toLocaleString('en-US')} mi`;
}
