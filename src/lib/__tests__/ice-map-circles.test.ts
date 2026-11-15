// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CITY_CIRCLE_MAX_RADIUS,
  CITY_CIRCLE_MIN_RADIUS,
  cityCircleRadius,
} from '@/components/ice-alerts/map-circles';

describe('cityCircleRadius', () => {
  it('grows monotonically as a city total grows', () => {
    const radii = [1, 10, 100, 1_000, 10_000].map((count) =>
      cityCircleRadius(count, 29_537)
    );

    for (let i = 1; i < radii.length; i += 1) {
      expect(radii[i]).toBeGreaterThan(radii[i - 1]);
    }
  });

  it('uses the full radius range at the extremes', () => {
    expect(cityCircleRadius(0, 29_537)).toBe(CITY_CIRCLE_MIN_RADIUS);
    expect(cityCircleRadius(29_537, 29_537)).toBe(CITY_CIRCLE_MAX_RADIUS);
  });

  it('falls back safely when the snapshot has no positive maximum', () => {
    expect(cityCircleRadius(1, 0)).toBe(CITY_CIRCLE_MIN_RADIUS);
    expect(cityCircleRadius(Number.NaN, 10)).toBe(CITY_CIRCLE_MIN_RADIUS);
  });
});
