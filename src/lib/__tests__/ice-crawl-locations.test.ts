// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { CityPoint } from '@/components/ice-alerts/types';
import { resolveIceSourceReportLocation } from '@/lib/ice-crawl-locations';
import { createCityMatcher } from '@/lib/rapid-city-match';

const CITIES: CityPoint[] = [
  { city: 'Dallas', state: 'Texas', stateCode: 'TX', lat: 32.7, lng: -96.8, count: 1 },
  { city: 'Houston', state: 'Texas', stateCode: 'TX', lat: 29.7, lng: -95.3, count: 1 },
  { city: 'McAllen', state: 'Texas', stateCode: 'TX', lat: 26.2, lng: -98.2, count: 1 },
  { city: 'Tustin', state: 'California', stateCode: 'CA', lat: 33.7, lng: -117.8, count: 1 },
  { city: 'Whittier', state: 'California', stateCode: 'CA', lat: 33.9, lng: -118.0, count: 1 },
  { city: 'Boulevard', state: 'California', stateCode: 'CA', lat: 32.6, lng: -116.2, count: 1 },
];

const matcher = createCityMatcher(CITIES);

function row(overrides: {
  title: string;
  text?: string;
  city?: string | null;
  state?: string | null;
}) {
  return {
    id: 'row-1',
    title: overrides.title,
    text_content: overrides.text ?? '',
    city: overrides.city ?? null,
    state_code: overrides.state ?? null,
  };
}

describe('ice source location repair', () => {
  it('cleans a trailing apostrophe without changing the city', () => {
    expect(
      resolveIceSourceReportLocation(
        row({ title: 'Source report: 18120 Coit Rd Dallas TX 75252', city: "Dallas'", state: 'TX' }),
        matcher
      )
    ).toEqual({ city: 'Dallas', stateCode: 'TX' });
  });

  it('keeps a source-stated city and repairs a contradictory stored state', () => {
    expect(
      resolveIceSourceReportLocation(
        row({ title: 'Source report: Willowbrook CA 90061', city: 'Willowbrook', state: 'IL' }),
        matcher
      )
    ).toEqual({ city: 'Willowbrook', stateCode: 'CA' });
  });

  it('prefers the verified city nearest the state over a street name', () => {
    expect(
      resolveIceSourceReportLocation(
        row({
          title: 'Source report: 974 W Houston Ave McAllen TX 78501',
          city: 'Houston',
          state: 'TX',
        }),
        matcher
      )
    ).toEqual({ city: 'McAllen', stateCode: 'TX' });
  });

  it('drops a bare street-suffix place and uses the verified city', () => {
    expect(
      resolveIceSourceReportLocation(
        row({ title: 'Source report: Whittier Boulevard CA 90640', city: 'Boulevard', state: 'CA' }),
        matcher
      )
    ).toEqual({ city: 'Whittier', stateCode: 'CA' });
  });

  it('clears a road and highway number that was stored as a city', () => {
    expect(
      resolveIceSourceReportLocation(
        row({
          title: 'Source report: Country Village and 60 fwy Jurupa CA 91752',
          city: '60 Fwy Jurupa',
          state: 'CA',
        }),
        matcher
      )
    ).toEqual({ city: null, stateCode: 'CA' });
  });

  it('does not retain a generic city guessed without a state', () => {
    expect(
      resolveIceSourceReportLocation(
        row({
          title: 'Source report: 94110',
          text: 'ice van pulled over a driver on 101 south',
          city: 'Van',
          state: 'TX',
        }),
        matcher
      )
    ).toEqual({ city: null, stateCode: null });
  });

  it('retains a verified city that is explicitly named without a state', () => {
    expect(
      resolveIceSourceReportLocation(
        row({
          title: 'Source report: Tustin 92780',
          text: 'ice reported in Tustin this morning',
          city: 'Tustin',
          state: 'CA',
        }),
        matcher
      )
    ).toEqual({ city: 'Tustin', stateCode: 'CA' });
  });
});
