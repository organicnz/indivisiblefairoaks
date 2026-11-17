// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  distanceMilesBetween,
  exactSourceReportPlace,
  nearestSourceReportPlace,
  type SourceReportPlacePoint,
} from '@/lib/ice-source-report-location';

const PLACES = [
  { city: 'Sacramento', stateCode: 'CA', count: 42 },
  { city: 'Los Angeles', stateCode: 'CA', count: 80 },
  { city: 'Reno', stateCode: 'NV', count: 6 },
];

const SACRAMENTO = { lat: 38.5816, lng: -121.4944 };
const LOS_ANGELES = { lat: 34.0522, lng: -118.2437 };
const RENO = { lat: 39.5296, lng: -119.8138 };

describe('source report location resolver', () => {
  it('matches a city name regardless of case and prefers the requested state', () => {
    expect(exactSourceReportPlace(PLACES, 'sacramento', 'ca')).toMatchObject({
      city: 'Sacramento',
      stateCode: 'CA',
      count: 42,
    });
    expect(exactSourceReportPlace(PLACES, 'SPRINGFIELD', 'IL')).toBeNull();
  });

  it('uses the city with the most reports when no state is given', () => {
    const places = [
      { city: 'Springfield', stateCode: 'IL', count: 2 },
      { city: 'Springfield', stateCode: 'MO', count: 9 },
    ];
    expect(exactSourceReportPlace(places, 'Springfield')).toMatchObject({
      stateCode: 'MO',
      count: 9,
    });
  });

  it('calculates a plausible U.S. distance', () => {
    const miles = distanceMilesBetween(
      SACRAMENTO.lat,
      SACRAMENTO.lng,
      LOS_ANGELES.lat,
      LOS_ANGELES.lng
    );
    expect(miles).toBeGreaterThan(300);
    expect(miles).toBeLessThan(400);
  });

  it('selects the nearest city that has reports', () => {
    const points: SourceReportPlacePoint[] = [
      { ...PLACES[0], ...SACRAMENTO },
      { ...PLACES[1], ...LOS_ANGELES },
      { ...PLACES[2], ...RENO },
    ];
    const nearest = nearestSourceReportPlace(points, 38.6, -121.5);
    expect(nearest?.place.city).toBe('Sacramento');
    expect(nearest?.distanceMiles).toBeLessThan(5);
  });

  it('returns null when no candidate has a coordinate', () => {
    expect(nearestSourceReportPlace([], 38.6, -121.5)).toBeNull();
  });
});
