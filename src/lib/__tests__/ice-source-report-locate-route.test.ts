// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/ice-source-reports/locate/route';
import { getIceHeatmapSnapshot } from '@/lib/queries/ice-heatmap';
import { getSourceReportPlaces } from '@/lib/queries/ice-source-report-places';

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, connection: vi.fn() };
});

vi.mock('@/lib/queries/ice-heatmap', () => ({
  getIceHeatmapSnapshot: vi.fn(),
}));

vi.mock('@/lib/queries/ice-source-report-places', () => ({
  getSourceReportPlaces: vi.fn(),
}));

const PLACES = [
  { city: 'Sacramento', stateCode: 'CA', count: 42 },
  { city: 'Reno', stateCode: 'NV', count: 6 },
];

const CITIES = [
  {
    city: 'Sacramento',
    state: 'California',
    stateCode: 'CA',
    lat: 38.5816,
    lng: -121.4944,
    count: 728,
  },
  {
    city: 'Reno',
    state: 'Nevada',
    stateCode: 'NV',
    lat: 39.5296,
    lng: -119.8138,
    count: 40,
  },
];

function request(query: string) {
  return new Request(
    `http://localhost/api/ice-source-reports/locate?${query}`,
    { headers: { Accept: 'application/json' } }
  );
}

describe('GET /api/ice-source-reports/locate', () => {
  beforeEach(() => {
    vi.mocked(getSourceReportPlaces).mockResolvedValue(PLACES);
    vi.mocked(getIceHeatmapSnapshot).mockResolvedValue({ cities: CITIES } as never);
  });

  it('returns an exact city hint without needing a heat-map point', async () => {
    const response = await GET(
      request('lat=38.5816&lng=-121.4944&city=Sacramento&state=CA')
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      available: true,
      city: 'Sacramento',
      stateCode: 'CA',
      reportCount: 42,
      exact: true,
      distanceMiles: null,
    });
    expect(getIceHeatmapSnapshot).not.toHaveBeenCalled();
  });

  it('returns the nearest city with published reports', async () => {
    const response = await GET(request('lat=39.53&lng=-119.82'));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      available: true,
      city: 'Reno',
      stateCode: 'NV',
      reportCount: 6,
      exact: false,
    });
  });

  it('rejects a point outside the U.S. before reading report data', async () => {
    const response = await GET(request('lat=43.6532&lng=-79.3832'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      available: false,
      reason: 'outside-us',
    });
    expect(getSourceReportPlaces).not.toHaveBeenCalled();
  });

  it('returns a stable no-reports result when the archive is empty', async () => {
    vi.mocked(getSourceReportPlaces).mockResolvedValue([]);
    const response = await GET(request('lat=38.5816&lng=-121.4944'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      available: false,
      reason: 'no-reports',
    });
  });
});
