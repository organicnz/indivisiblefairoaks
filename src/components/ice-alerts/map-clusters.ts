import type { CityPoint } from './types';

/** At and above this zoom the map shows individual city dots. */
export const MAX_INDIVIDUAL_ZOOM = 10;

/** Cluster marker diameter range, in screen pixels. */
const CLUSTER_MIN_ICON_SIZE = 28;
const CLUSTER_MAX_ICON_SIZE = 34;

export type ProjectedPoint = { x: number; y: number };

export type CityCluster = {
  lat: number;
  lng: number;
  records: number;
  cityCount: number;
  cities: CityPoint[];
};

/**
 * Screen-space cell size for a zoom level. The cells get smaller as the view
 * tightens, so an overview keeps the map legible while a regional view still
 * separates nearby cities. At zoom 9+ every city is drawn individually.
 */
export function clusterCellSize(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom >= 9) return 0;
  if (zoom <= 4) return 72;
  return Math.max(40, 72 - (Math.floor(zoom) - 4) * 8);
}

/**
 * Bucket nearby city points into a fixed screen-space grid. The cluster centre
 * is weighted by record count, not city count: a 30,000-record city should pull
 * its cluster toward itself more than a one-record neighbour.
 */
export function clusterCityPoints(
  cities: readonly CityPoint[],
  project: (city: CityPoint) => ProjectedPoint,
  cellSize: number
): CityCluster[] {
  if (cellSize <= 0) {
    return cities.map((city) => ({
      lat: city.lat,
      lng: city.lng,
      records: Math.max(0, city.count),
      cityCount: 1,
      cities: [city],
    }));
  }

  type Bucket = {
    lat: number;
    lng: number;
    records: number;
    cityCount: number;
    cities: CityPoint[];
  };

  const buckets = new Map<string, Bucket>();

  for (const city of cities) {
    if (!Number.isFinite(city.lat) || !Number.isFinite(city.lng)) continue;

    const point = project(city);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;

    const key = `${Math.floor(point.x / cellSize)}:${Math.floor(point.y / cellSize)}`;
    const weight = Math.max(1, city.count);
    const bucket = buckets.get(key) ?? {
      lat: 0,
      lng: 0,
      records: 0,
      cityCount: 0,
      cities: [],
    };

    bucket.lat += city.lat * weight;
    bucket.lng += city.lng * weight;
    bucket.records += Math.max(0, city.count);
    bucket.cityCount += 1;
    bucket.cities.push(city);
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      lat: bucket.lat / Math.max(1, bucket.records),
      lng: bucket.lng / Math.max(1, bucket.records),
      records: bucket.records,
      cityCount: bucket.cityCount,
      cities: bucket.cities,
    }))
    .sort((a, b) => b.records - a.records);
}

/** Compact marker text: 1.2k, 29.5k, 760k, 1m. */
export function formatCompactCount(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  if (safe < 1_000) return new Intl.NumberFormat('en-US').format(safe);

  const useMillions = safe >= 1_000_000;
  const amount = safe / (useMillions ? 1_000_000 : 1_000);
  const rounded = amount >= 10 ? Math.round(amount) : Math.round(amount * 10) / 10;

  if (!useMillions && rounded >= 1_000) return '1m';
  return `${rounded}${useMillions ? 'm' : 'k'}`;
}

/** Marker diameter grows with the record total but stays readable at overview. */
export function clusterIconSize(records: number, maxRecords: number): number {
  if (!Number.isFinite(maxRecords) || maxRecords <= 0) return CLUSTER_MIN_ICON_SIZE;

  const safeRecords = Number.isFinite(records)
    ? Math.min(Math.max(0, records), maxRecords)
    : 0;
  const ratio = Math.log1p(safeRecords) / Math.log1p(maxRecords);

  return (
    CLUSTER_MIN_ICON_SIZE +
    (CLUSTER_MAX_ICON_SIZE - CLUSTER_MIN_ICON_SIZE) * Math.min(1, Math.max(0, ratio))
  );
}
