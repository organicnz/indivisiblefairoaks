// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  formatLocalMiles,
  nearestRapidPoint,
  rankRapidPointsByDistance,
} from '@/components/ice-alerts/rapid-local';
import type { RapidMapPoint } from '@/components/ice-alerts/rapid-types';

const NOW = '2026-11-18T12:00:00.000Z';

function point(
  city: string,
  lat: number,
  lng: number,
  overrides: Partial<RapidMapPoint> = {}
): RapidMapPoint {
  return {
    id: `${city}|CA`,
    city,
    stateCode: 'CA',
    place: `${city}, CA`,
    lat,
    lng,
    count: 1,
    alertIds: [`${city}-alert`],
    latestAlertId: `${city}-alert`,
    latestAt: NOW,
    kind: 'enforcement',
    latestStatus: 'sighting',
    status: 'sighting',
    hasActive: true,
    ...overrides,
  };
}

const SACRAMENTO = point('Sacramento', 38.5816, -121.4944);
const STOCKTON = point('Stockton', 37.9577, -121.2908);
const LOS_ANGELES = point('Los Angeles', 34.0522, -118.2437);

describe('rapid local distance ranking', () => {
  it('ranks city centroids by distance and honors the radius', () => {
    const local = rankRapidPointsByDistance(
      [LOS_ANGELES, STOCKTON, SACRAMENTO],
      38.5816,
      -121.4944,
      100
    );

    expect(local.map((item) => item.city)).toEqual(['Sacramento', 'Stockton']);
    expect(local[0]?.distanceMiles).toBeLessThan(1);
    expect(local[1]?.distanceMiles).toBeGreaterThan(25);
  });

  it('returns the nearest point even when it is outside the selected radius', () => {
    expect(
      rankRapidPointsByDistance([LOS_ANGELES], 38.5816, -121.4944, 25)
    ).toHaveLength(0);
    expect(nearestRapidPoint([LOS_ANGELES], 38.5816, -121.4944)?.city).toBe(
      'Los Angeles'
    );
  });

  it('formats sub-mile and rounded distances honestly', () => {
    expect(formatLocalMiles(0.4)).toBe('<1 mi');
    expect(formatLocalMiles(41.6)).toBe('42 mi');
    expect(formatLocalMiles(Number.NaN)).toBe('Distance unavailable');
  });
});
