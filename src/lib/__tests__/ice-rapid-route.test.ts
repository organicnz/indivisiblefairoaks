// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRapidFeed = vi.hoisted(() => vi.fn());
const getRapidPublicCases = vi.hoisted(() => vi.fn(async () => []));
const usable = vi.hoisted(() => vi.fn(() => true));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, connection: vi.fn(async () => undefined) };
});

vi.mock('@/lib/ice-rapid-feed', () => ({
  getRapidFeed,
  hasUsableRapidFeed: usable,
}));

vi.mock('@/lib/queries/ice-public-cases', () => ({
  getRapidPublicCases,
}));

const { GET } = await import('@/app/api/ice-rapid/route');

const FEED = {
  generatedAt: '2026-11-15T06:00:00.000Z',
  community: {
    status: 'ok',
    sourceName: 'Stop ICE Alerts Network',
    sourceUrl: 'https://stopice.net/',
    checkedAt: '2026-11-15T06:00:00.000Z',
    latestAt: '2026-11-15T03:00:00.000Z',
    itemCount: 1,
    note: 'ok',
  },
  official: {
    status: 'ok',
    sourceName: 'ICE Newsroom',
    sourceUrl: 'https://www.ice.gov/newsroom',
    checkedAt: '2026-11-15T06:00:00.000Z',
    latestAt: '2026-11-09T20:57:26.000Z',
    itemCount: 1,
    note: 'ok',
  },
  alerts: [
    {
      id: 'one',
      source: 'community' as const,
      sourceName: 'Stop ICE Alerts Network',
      sourceUrl: 'https://stopice.net/',
      kind: 'enforcement' as const,
      status: 'sighting' as const,
      title: 'Community report',
      city: 'Santa Ana',
      stateCode: 'CA',
      place: 'Santa Ana, CA',
      lat: 33.7,
      lng: -117.8,
      observedAt: '2026-11-15T03:00:00.000Z',
      expiresAt: '2026-11-15T07:00:00.000Z',
      summary: 'A city-level report.',
    },
  ],
  officialReleases: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  getRapidFeed.mockResolvedValue(FEED);
  getRapidPublicCases.mockResolvedValue([]);
  usable.mockReturnValue(true);
});

describe('GET /api/ice-rapid', () => {
  it('serves the normalized feed with a long stale window', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('stale-while-revalidate=86400');
    expect(response.headers.get('cache-control')).toContain('stale-if-error=86400');
    expect(await response.json()).toMatchObject({ alerts: FEED.alerts, publicCases: [] });
  });

  it('answers 503 without poisoning the edge cache when every source is unavailable', async () => {
    usable.mockReturnValue(false);
    getRapidFeed.mockResolvedValue({ ...FEED, alerts: [], officialReleases: [] });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('retry-after')).toBe('5');
  });
});
