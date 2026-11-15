// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  clusterCellSize,
  clusterCityPoints,
  clusterIconSize,
  formatCompactCount,
  MAX_INDIVIDUAL_ZOOM,
} from '@/components/ice-alerts/map-clusters';
import type { CityPoint } from '@/components/ice-alerts/types';

const city = (overrides: Partial<CityPoint>): CityPoint => ({
  city: 'Test',
  state: 'CALIFORNIA',
  stateCode: 'CA',
  lat: 0,
  lng: 0,
  count: 1,
  ...overrides,
});

describe('clusterCellSize', () => {
  it('keeps a wide overview while tightening as the user zooms in', () => {
    expect(clusterCellSize(3)).toBe(72);
    expect(clusterCellSize(5)).toBe(64);
    expect(clusterCellSize(8)).toBe(40);
  });

  it('turns clustering off for individual city zooms', () => {
    expect(clusterCellSize(MAX_INDIVIDUAL_ZOOM - 1)).toBe(0);
    expect(clusterCellSize(MAX_INDIVIDUAL_ZOOM)).toBe(0);
  });
});

describe('clusterCityPoints', () => {
  it('groups points in the same screen cell and sums their records', () => {
    const cities = [
      city({ city: 'A', lat: 10, lng: 10, count: 1 }),
      city({ city: 'B', lat: 20, lng: 20, count: 3 }),
    ];

    const [cluster] = clusterCityPoints(cities, () => ({ x: 10, y: 10 }), 100);
    expect(cluster).toMatchObject({ records: 4, cityCount: 2 });
    expect(cluster.cities).toHaveLength(2);
  });

  it('weights the cluster centre by record count', () => {
    const cities = [
      city({ city: 'A', lat: 10, lng: 10, count: 1 }),
      city({ city: 'B', lat: 20, lng: 20, count: 3 }),
    ];

    const [cluster] = clusterCityPoints(cities, () => ({ x: 10, y: 10 }), 100);
    expect(cluster.lat).toBe(17.5);
    expect(cluster.lng).toBe(17.5);
  });

  it('keeps points in different cells separate', () => {
    const cities = [
      city({ city: 'A', lat: 10, lng: 10 }),
      city({ city: 'B', lat: 20, lng: 20 }),
    ];

    const clusters = clusterCityPoints(
      cities,
      (point) => ({ x: point.city === 'A' ? 10 : 110, y: 10 }),
      100
    );
    expect(clusters).toHaveLength(2);
  });

  it('returns one cluster per city when clustering is off', () => {
    const cities = [city({ city: 'A' }), city({ city: 'B' })];
    const clusters = clusterCityPoints(cities, () => ({ x: 0, y: 0 }), 0);
    expect(clusters).toHaveLength(2);
    expect(clusters.every((cluster) => cluster.cityCount === 1)).toBe(true);
  });
});

describe('formatCompactCount', () => {
  it('uses compact labels that fit a cluster marker', () => {
    expect(formatCompactCount(7)).toBe('7');
    expect(formatCompactCount(1_000)).toBe('1k');
    expect(formatCompactCount(1_500)).toBe('1.5k');
    expect(formatCompactCount(29_537)).toBe('30k');
    expect(formatCompactCount(760_248)).toBe('760k');
    expect(formatCompactCount(1_000_000)).toBe('1m');
  });
});

describe('clusterIconSize', () => {
  it('stays within the readable marker range and grows with records', () => {
    expect(clusterIconSize(0, 760_248)).toBe(28);
    expect(clusterIconSize(760_248, 760_248)).toBe(34);
    expect(clusterIconSize(29_537, 760_248)).toBeGreaterThan(
      clusterIconSize(100, 760_248)
    );
  });

  it('falls back safely when the snapshot has no total', () => {
    expect(clusterIconSize(10, 0)).toBe(28);
    expect(clusterIconSize(Number.NaN, 10)).toBe(28);
  });
});
