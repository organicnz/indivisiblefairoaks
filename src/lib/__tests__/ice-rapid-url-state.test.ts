// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  parseRapidUrlState,
  serializeRapidUrlState,
} from '@/components/ice-alerts/rapid-url-state';

describe('parseRapidUrlState', () => {
  it('restores a U.S. viewport and a valid alert id', () => {
    const state = parseRapidUrlState({
      lat: '39.5',
      lng: '-98.35',
      z: '6',
      alert: 'stopice-1794718514043',
    });

    expect(state.initialView).toEqual({ center: [39.5, -98.35], zoom: 6 });
    expect(state.initialMapView).toBe('free');
    expect(state.initialAlertId).toBe('stopice-1794718514043');
    expect(state.hasUrlState).toBe(true);
  });

  it('ignores a non-U.S. viewport and a crafted alert id', () => {
    const state = parseRapidUrlState({
      lat: '48.8566',
      lng: '2.3522',
      z: '7',
      alert: '<script>alert(1)</script>',
    });

    expect(state.initialView).toBeNull();
    expect(state.initialAlertId).toBeNull();
    expect(state.hasUrlState).toBe(false);
  });

  it('clamps zoom to the map limits', () => {
    expect(parseRapidUrlState({ lat: '39', lng: '-98', z: '99' }).initialView?.zoom).toBe(19);
    expect(parseRapidUrlState({ lat: '39', lng: '-98', z: '-4' }).initialView?.zoom).toBe(3);
  });
});

describe('serializeRapidUrlState', () => {
  it('writes view state and preserves unrelated parameters', () => {
    const base = new URLSearchParams('utm_source=share&alert=old');
    const params = serializeRapidUrlState(base, {
      viewport: { center: [39.5, -98.35], zoom: 6.25 },
      mapView: 'free',
      selectedAlertId: 'stopice-123',
    });

    expect(params.get('utm_source')).toBe('share');
    expect(params.get('alert')).toBe('stopice-123');
    expect(params.get('lat')).toBe('39.5');
    expect(params.get('lng')).toBe('-98.35');
    expect(params.get('z')).toBe('6.25');
  });

  it('never writes a user-derived local view', () => {
    const base = new URLSearchParams('lat=38.5&lng=-121.4&z=9&alert=stopice-123&keep=1');
    const params = serializeRapidUrlState(base, {
      viewport: { center: [38.5, -121.4], zoom: 9 },
      mapView: 'local',
      selectedAlertId: 'stopice-123',
    });

    expect(params.has('lat')).toBe(false);
    expect(params.has('lng')).toBe(false);
    expect(params.has('z')).toBe(false);
    expect(params.has('alert')).toBe(false);
    expect(params.get('keep')).toBe('1');
  });
});
