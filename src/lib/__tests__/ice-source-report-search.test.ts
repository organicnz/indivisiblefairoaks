// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  cleanIceSourceReportCityName,
  iceSourceReportArchiveHref,
  iceSourceReportDisplayTitle,
  iceSourceReportExportHref,
  iceSourceReportPlaceLabel,
  iceSourceReportTitleGeneralized,
  normalizeIceSourceReportCity,
  normalizeIceSourceReportQuery,
  parseIceSourceReportFilters,
} from '@/lib/ice-source-report-search';

describe('source report search filters', () => {
  it('normalizes a term and strips PostgREST filter syntax', () => {
    expect(normalizeIceSourceReportQuery('  Sacramento, (CA)%  ')).toBe('Sacramento CA');
    expect(normalizeIceSourceReportQuery('a'.repeat(120))).toHaveLength(80);
    expect(normalizeIceSourceReportQuery(null)).toBe('');
  });

  it('normalizes a city while keeping apostrophes and periods', () => {
    expect(normalizeIceSourceReportCity("  O'Fallon, MO%  ")).toBe("O'Fallon MO");
    expect(normalizeIceSourceReportCity('  West St. Paul, MN  ')).toBe('West St. Paul MN');
    expect(normalizeIceSourceReportCity('Sacramento')).toBe('Sacramento');
    expect(normalizeIceSourceReportCity(null)).toBe('');
  });

  it('cleans punctuation that leaks into a displayed city label', () => {
    expect(cleanIceSourceReportCityName('New York-')).toBe('New York');
    expect(cleanIceSourceReportCityName("Dallas'")).toBe('Dallas');
    expect(iceSourceReportPlaceLabel('New York-', 'NY')).toBe('New York, NY');
    expect(iceSourceReportPlaceLabel(null, 'CA')).toBe('CA');
    expect(iceSourceReportPlaceLabel(null, null)).toBe('Location not stated');
  });

  it('does not publish address-shaped source titles', () => {
    expect(
      iceSourceReportDisplayTitle({
        title: 'Source report: 4087 Palm Beach Blvd Fort Myers FL 33916',
        kind: 'enforcement',
        city: 'Fort Myers',
        state_code: 'FL',
      })
    ).toBe('Source report · Enforcement in Fort Myers, FL');

    expect(
      iceSourceReportDisplayTitle({
        title: '230 S Alvarado St Los Angeles Ca 90057 At least one person detained',
        kind: 'detention',
        city: 'Los Angeles',
        state_code: 'CA',
      })
    ).toBe('Source report · Detention in Los Angeles, CA');
  });

  it('marks only address-shaped or generic titles as generalized', () => {
    expect(
      iceSourceReportTitleGeneralized({
        title: '4087 Palm Beach Blvd Fort Myers FL 33916',
        kind: 'enforcement',
        city: 'Fort Myers',
        state_code: 'FL',
      })
    ).toBe(true);
    expect(
      iceSourceReportTitleGeneralized({
        title: 'ICE announces new field office guidance',
        kind: 'other',
        city: null,
        state_code: null,
      })
    ).toBe(false);
  });

  it('keeps a real source headline and supplies a safe fallback without a place', () => {
    expect(
      iceSourceReportDisplayTitle({
        title: 'ICE announces new field office guidance',
        kind: 'other',
        city: null,
        state_code: null,
      })
    ).toBe('ICE announces new field office guidance');

    expect(
      iceSourceReportDisplayTitle({
        title: 'Source report: unknown location',
        kind: 'other',
        city: null,
        state_code: null,
      })
    ).toBe('Source report · Other');
  });

  it('accepts only known kinds and state codes', () => {
    expect(
      parseIceSourceReportFilters(
        new URLSearchParams({ q: 'santa ana', kind: 'detention', state: 'ca' })
      )
    ).toEqual({ query: 'santa ana', kind: 'detention', stateCode: 'CA', city: '' });

    expect(
      parseIceSourceReportFilters({ kind: 'not-a-kind', state: 'ZZ' })
    ).toEqual({ query: '', kind: 'all', stateCode: '', city: '' });
  });

  it('round-trips filters into archive and export links', () => {
    const filters = parseIceSourceReportFilters({
      q: 'oakland',
      kind: 'enforcement',
      state: 'CA',
      city: 'Oakland',
    });

    expect(iceSourceReportArchiveHref(filters, 3)).toBe(
      '/ice-alerts/web-reports?q=oakland&kind=enforcement&state=CA&city=Oakland&page=3'
    );
    expect(iceSourceReportExportHref('xml', filters)).toBe(
      '/api/ice-source-reports/export?q=oakland&kind=enforcement&state=CA&city=Oakland&format=xml'
    );
  });
});
