// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isUsPoint } from '@/lib/geo/us-boundary';

const US_POINTS: ReadonlyArray<readonly [name: string, lat: number, lng: number]> = [
  ['Seattle', 47.6062, -122.3321],
  ['Detroit', 42.3314, -83.0458],
  ['International Falls', 48.601, -93.41],
  ['Northwest Angle', 49.38, -95.15],
  ['Point Roberts', 48.985, -123.08],
  ['Nogales, Arizona', 31.3404, -110.9343],
  ['El Paso', 31.7619, -106.485],
  ['Anchorage', 61.2181, -149.9003],
  ['Honolulu', 21.3069, -157.8583],
  ['Bayamón', 18.3985, -66.155],
  ['Charlotte Amalie', 18.3419, -64.9307],
  ['Hagåtña', 13.4767, 144.75],
  ['Saipan', 15.1778, 145.75],
  ['Pago Pago', -14.2756, -170.702],
];

const NON_US_POINTS: ReadonlyArray<readonly [name: string, lat: number, lng: number]> = [
  // The former bounding boxes accepted all of these.
  ['Toronto', 43.6532, -79.3832],
  ['Vancouver', 49.2827, -123.1207],
  ['Windsor', 42.3149, -83.0364],
  ['Tijuana', 32.5149, -117.0382],
  ['Ciudad Juárez', 31.6904, -106.4245],
  ['Matamoros', 25.869, -97.5023],
  // Open water, not a land boundary.
  ['Gulf of Mexico', 25.0, -90.0],
];

describe('isUsPoint', () => {
  it.each(US_POINTS)('accepts %s', (_name, lat, lng) => {
    expect(isUsPoint(lat, lng)).toBe(true);
  });

  it.each(NON_US_POINTS)('rejects %s', (_name, lat, lng) => {
    expect(isUsPoint(lat, lng)).toBe(false);
  });

  it('rejects non-finite coordinates', () => {
    expect(isUsPoint(Number.NaN, -97)).toBe(false);
    expect(isUsPoint(38, Number.POSITIVE_INFINITY)).toBe(false);
  });
});
