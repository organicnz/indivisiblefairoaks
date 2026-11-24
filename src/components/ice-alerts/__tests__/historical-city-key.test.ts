// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildHistoricalCityCounts,
  historicalCityKey,
} from '@/components/ice-alerts/historical-city-key';

describe('historical city key', () => {
  it('normalizes the state code and city before joining them', () => {
    expect(historicalCityKey({ city: '  Fair Oaks  ', stateCode: ' ca ' })).toBe('CA|fair oaks');
    expect(historicalCityKey({ city: 'CARMICHAEL', stateCode: 'Ca' })).toBe('CA|carmichael');
  });

  it('builds one keyed count per normalized city', () => {
    expect(
      buildHistoricalCityCounts([
        { city: 'Fair Oaks', stateCode: 'CA', count: 7 },
        { city: 'Carmichael', stateCode: 'CA', count: 3 },
        { city: 'El Paso', stateCode: 'TX', count: 2 },
      ])
    ).toEqual({
      'CA|fair oaks': 7,
      'CA|carmichael': 3,
      'TX|el paso': 2,
    });
  });

  it('keeps the first count when a release contains duplicate city rows', () => {
    expect(
      buildHistoricalCityCounts([
        { city: 'Fair Oaks', stateCode: 'CA', count: 7 },
        { city: ' fair oaks ', stateCode: ' ca ', count: 99 },
      ])
    ).toEqual({ 'CA|fair oaks': 7 });
  });

  it('returns an empty index for an empty city list', () => {
    expect(buildHistoricalCityCounts([])).toEqual({});
  });
});
