// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CITY_FOCUS_ZOOM,
  LOCATION_SEARCH_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  NATIONWIDE_ZOOM,
} from '@/components/ice-alerts/constants';
import {
  parseIceMapUrlState,
  serializeIceMapUrlState,
} from '@/components/ice-alerts/map-url-state';
import type { CityPoint } from '@/components/ice-alerts/types';

const CITIES: CityPoint[] = [
  {
    city: 'Conroe',
    state: 'TEXAS',
    stateCode: 'TX',
    lat: 30.32872,
    lng: -95.4846,
    count: 29_537,
  },
];
const conroe = CITIES[0];
const fifthAvenue = {
  lat: 40.7484,
  lng: -73.9857,
  label: '350 5th Avenue, New York, New York County, New York, United States',
};

describe('parseIceMapUrlState', () => {
  it('restores a city from the Supabase snapshot and centers its map view', () => {
    const state = parseIceMapUrlState(
      new URLSearchParams('city=Conroe&state=tx'),
      CITIES
    );

    expect(state.selectedCity).toEqual(conroe);
    expect(state.searchTarget).toBeNull();
    expect(state.initialView).toEqual({
      center: [conroe.lat, conroe.lng],
      zoom: CITY_FOCUS_ZOOM,
    });
    expect(state.initialMapView).toBe('free');
    expect(state.hasUrlState).toBe(true);
  });

  it('restores a search pin without requiring another geocode', () => {
    const params = new URLSearchParams({
      pin: '40.7484,-73.9857',
      pinLabel: fifthAvenue.label,
      q: '350 5th Ave, New York, NY',
    });

    const state = parseIceMapUrlState(params, CITIES);

    expect(state.searchTarget).toEqual(fifthAvenue);
    expect(state.searchQuery).toBe('350 5th Ave, New York, NY');
    expect(state.initialView).toEqual({
      center: [fifthAvenue.lat, fifthAvenue.lng],
      zoom: LOCATION_SEARCH_ZOOM,
    });
    expect(state.initialMapView).toBe('free');
    expect(state.hasUrlState).toBe(true);
  });

  it('restores an explicit viewport and clamps the zoom', () => {
    const high = parseIceMapUrlState(
      new URLSearchParams('lat=38.5816&lng=-121.4944&z=999'),
      CITIES
    );
    const low = parseIceMapUrlState(
      new URLSearchParams('lat=38.5816&lng=-121.4944&z=-20'),
      CITIES
    );

    expect(high.initialView).toEqual({
      center: [38.5816, -121.4944],
      zoom: MAX_ZOOM,
    });
    expect(low.initialView).toEqual({
      center: [38.5816, -121.4944],
      zoom: MIN_ZOOM,
    });
  });

  it('uses the default zoom when lat/lng have no zoom', () => {
    const state = parseIceMapUrlState(
      new URLSearchParams('lat=38.5816&lng=-121.4944'),
      CITIES
    );

    expect(state.initialView?.zoom).toBe(NATIONWIDE_ZOOM);
  });

  it('ignores non-U.S. coordinates instead of clamping them into the map', () => {
    const state = parseIceMapUrlState(
      new URLSearchParams(
        'city=Conroe&state=TX&lat=43.6532&lng=-79.3832&z=9&pin=43.6532,-79.3832&q=Toronto'
      ),
      CITIES
    );

    expect(state.initialView).toEqual({
      center: [conroe.lat, conroe.lng],
      zoom: CITY_FOCUS_ZOOM,
    });
    expect(state.searchTarget).toBeNull();
  });

  it('rejects a city that is not in the snapshot and never accepts a count', () => {
    const state = parseIceMapUrlState(
      new URLSearchParams(
        'city=Atlantis&state=ZZ&count=1&records=1&report=invented'
      ),
      CITIES
    );

    expect(state.selectedCity).toBeNull();
    expect(state.initialView).toBeNull();
    expect(state.hasUrlState).toBe(false);
  });

  it('resolves counts from the snapshot even when the URL supplies one', () => {
    const state = parseIceMapUrlState(
      new URLSearchParams('city=Conroe&state=TX&count=1&records=1'),
      CITIES
    );

    expect(state.selectedCity).toEqual(conroe);
    expect(state.selectedCity?.count).toBe(conroe.count);
    expect(state.selectedCity?.count).not.toBe(1);
  });

  it('does not treat a bare query as a restored search result', () => {
    const state = parseIceMapUrlState(new URLSearchParams('q=350 5th Ave'), CITIES);

    expect(state.searchTarget).toBeNull();
    expect(state.hasUrlState).toBe(false);
  });

  it('reads namespaced historical state without consuming the rapid viewport', () => {
    const state = parseIceMapUrlState(
      new URLSearchParams(
        'lat=39&lng=-98&z=5&foiaCity=Conroe&foiaState=TX'
      ),
      CITIES,
      { keyPrefix: 'foia' }
    );

    expect(state.selectedCity).toEqual(conroe);
    expect(state.initialView).toEqual({
      center: [conroe.lat, conroe.lng],
      zoom: CITY_FOCUS_ZOOM,
    });
    expect(state.hasUrlState).toBe(true);

    const rapidOnly = parseIceMapUrlState(
      new URLSearchParams('lat=39&lng=-98&z=5'),
      CITIES,
      { keyPrefix: 'foia' }
    );
    expect(rapidOnly.hasUrlState).toBe(false);
  });

  it('can read legacy unprefixed history keys for old links', () => {
    const state = parseIceMapUrlState(
      new URLSearchParams('city=Conroe&state=TX'),
      CITIES,
      { keyPrefix: 'foia', includeUnprefixed: true }
    );

    expect(state.selectedCity).toEqual(conroe);
    expect(state.initialView).toEqual({
      center: [conroe.lat, conroe.lng],
      zoom: CITY_FOCUS_ZOOM,
    });
  });
});

describe('serializeIceMapUrlState', () => {
  it('writes only view parameters and preserves unrelated ones', () => {
    const base = new URLSearchParams('utm_source=test&count=1');
    const params = serializeIceMapUrlState(base, {
      selectedCity: conroe,
      searchTarget: null,
      searchQuery: '',
      viewport: { center: [conroe.lat, conroe.lng], zoom: CITY_FOCUS_ZOOM },
      mapView: 'free',
    });

    expect(params.get('city')).toBe('Conroe');
    expect(params.get('state')).toBe('TX');
    expect(params.get('lat')).toBe('30.32872');
    expect(params.get('lng')).toBe('-95.4846');
    expect(params.get('z')).toBe('9');
    expect(params.get('utm_source')).toBe('test');
    // Preserved but ignored by the parser: URL fields can never become data.
    expect(params.get('count')).toBe('1');
  });

  it('writes a search pin and its query', () => {
    const params = serializeIceMapUrlState(new URLSearchParams(), {
      selectedCity: null,
      searchTarget: fifthAvenue,
      searchQuery: '350 5th Ave, New York, NY',
      viewport: { center: [fifthAvenue.lat, fifthAvenue.lng], zoom: 12 },
      mapView: 'free',
    });

    expect(params.get('pin')).toBe('40.7484,-73.9857');
    expect(params.get('pinLabel')).toBe(fifthAvenue.label);
    expect(params.get('q')).toBe('350 5th Ave, New York, NY');
    expect(params.get('lat')).toBe('40.7484');
    expect(params.get('lng')).toBe('-73.9857');
    expect(params.get('z')).toBe('12');
  });

  it('never writes a local view to the URL', () => {
    const params = serializeIceMapUrlState(
      new URLSearchParams('city=Conroe&state=TX&lat=30.3&lng=-95.4&z=9&utm=x'),
      {
        selectedCity: conroe,
        searchTarget: null,
        searchQuery: '',
        viewport: { center: [conroe.lat, conroe.lng], zoom: CITY_FOCUS_ZOOM },
        mapView: 'local',
      }
    );

    expect([...params.keys()]).toEqual(['utm']);
  });

  it('namespaces historical keys and leaves the rapid viewport intact', () => {
    const params = serializeIceMapUrlState(
      new URLSearchParams('view=history&city=Conroe&state=TX&lat=39&lng=-98&z=5'),
      {
        selectedCity: conroe,
        searchTarget: null,
        searchQuery: '',
        viewport: { center: [conroe.lat, conroe.lng], zoom: CITY_FOCUS_ZOOM },
        mapView: 'free',
      },
      { keyPrefix: 'foia' }
    );

    expect(params.get('view')).toBe('history');
    expect(params.get('foiaCity')).toBe('Conroe');
    expect(params.get('foiaState')).toBe('TX');
    expect(params.get('foiaLat')).toBe('30.32872');
    expect(params.get('foiaZ')).toBe('9');
    // The rapid map's own viewport and the legacy history keys do not collide.
    expect(params.get('lat')).toBe('39');
    expect(params.get('lng')).toBe('-98');
    expect(params.get('z')).toBe('5');
    expect(params.get('city')).toBeNull();
    expect(params.get('state')).toBeNull();
  });

  it('round-trips namespaced historical state', () => {
    const original = parseIceMapUrlState(
      new URLSearchParams(
        'foiaCity=Conroe&foiaState=TX&foiaPin=40.7484,-73.9857&foiaPinLabel=350+5th+Avenue&foiaQ=350+5th+Ave&foiaLat=38.5816&foiaLng=-121.4944&foiaZ=7'
      ),
      CITIES,
      { keyPrefix: 'foia' }
    );
    const params = serializeIceMapUrlState(
      new URLSearchParams(),
      {
        selectedCity: original.selectedCity,
        searchTarget: original.searchTarget,
        searchQuery: original.searchQuery,
        viewport: original.initialView,
        mapView: original.initialMapView,
      },
      { keyPrefix: 'foia' }
    );
    const restored = parseIceMapUrlState(params, CITIES, { keyPrefix: 'foia' });

    expect(restored.selectedCity).toEqual(conroe);
    expect(restored.searchTarget).toEqual({
      lat: 40.7484,
      lng: -73.9857,
      label: '350 5th Avenue',
    });
    expect(restored.searchQuery).toBe('350 5th Ave');
    expect(restored.initialView).toEqual({
      center: [38.5816, -121.4944],
      zoom: 7,
    });
  });

  it('round-trips a city, pin, query, and viewport', () => {
    const original = parseIceMapUrlState(
      new URLSearchParams(
        'city=Conroe&state=TX&pin=40.7484,-73.9857&pinLabel=350+5th+Avenue&q=350+5th+Ave&lat=38.5816&lng=-121.4944&z=7'
      ),
      CITIES
    );
    const params = serializeIceMapUrlState(new URLSearchParams(), {
      selectedCity: original.selectedCity,
      searchTarget: original.searchTarget,
      searchQuery: original.searchQuery,
      viewport: original.initialView,
      mapView: original.initialMapView,
    });
    const restored = parseIceMapUrlState(params, CITIES);

    expect(restored.selectedCity).toEqual(conroe);
    expect(restored.searchTarget).toEqual({
      lat: 40.7484,
      lng: -73.9857,
      label: '350 5th Avenue',
    });
    expect(restored.searchQuery).toBe('350 5th Ave');
    expect(restored.initialView).toEqual({
      center: [38.5816, -121.4944],
      zoom: 7,
    });
  });
});
