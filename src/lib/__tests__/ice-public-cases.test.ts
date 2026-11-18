// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { IceReportPublicRow } from '@/lib/ice-report-shared';

const mocks = vi.hoisted(() => ({
  getPublishedIceReports: vi.fn(),
}));

vi.mock('@/lib/ice-report-intake', () => ({
  getIceReportStore: () => ({}),
  getPublishedIceReports: mocks.getPublishedIceReports,
}));

import { getRapidPublicCases } from '@/lib/queries/ice-public-cases';

const ROW: IceReportPublicRow = {
  id: 'public-sacramento-1',
  report_id: 'private-report-id',
  city: 'Sacramento',
  state_code: 'CA',
  kind: 'enforcement',
  observed_at: '2026-11-18T10:00:00.000Z',
  summary:
    'Community report of enforcement activity in Sacramento, CA. City-level only; not independently verified.',
  lat: 38.5816,
  lng: -121.4944,
  corroboration_count: 2,
  published_at: '2026-11-18T10:05:00.000Z',
  expires_at: '2026-11-25T10:05:00.000Z',
};

describe('getRapidPublicCases', () => {
  it('maps public rows without exposing the private report id', async () => {
    mocks.getPublishedIceReports.mockResolvedValue([ROW]);

    const cases = await getRapidPublicCases();

    expect(cases).toEqual([
      {
        id: ROW.id,
        city: ROW.city,
        stateCode: ROW.state_code,
        place: 'Sacramento, CA',
        kind: 'enforcement',
        observedAt: ROW.observed_at,
        summary: ROW.summary,
        lat: ROW.lat,
        lng: ROW.lng,
        corroborationCount: 2,
      },
    ]);
    expect(cases[0]).not.toHaveProperty('report_id');
  });

  it('drops rows that cannot be safely plotted', async () => {
    mocks.getPublishedIceReports.mockResolvedValue([
      ROW,
      { ...ROW, id: 'bad-kind', kind: 'other' },
      { ...ROW, id: 'bad-coordinate', lat: Number.NaN },
    ]);

    const cases = await getRapidPublicCases();

    expect(cases.map((row) => row.id)).toEqual([ROW.id]);
  });

  it('returns no map cases when Supabase is unavailable', async () => {
    mocks.getPublishedIceReports.mockRejectedValue(new Error('unavailable'));

    await expect(getRapidPublicCases()).resolves.toEqual([]);
  });
});
