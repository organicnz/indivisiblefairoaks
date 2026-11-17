// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  iceSourceReportArchiveHref,
  iceSourceReportExportHref,
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
