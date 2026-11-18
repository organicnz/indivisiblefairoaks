// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRapidFeedResult = vi.hoisted(() => vi.fn());
const getRapidPublicCases = vi.hoisted(() => vi.fn(async () => []));
const usable = vi.hoisted(() => vi.fn(() => true));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, connection: vi.fn(async () => undefined) };
});

vi.mock('@/lib/ice-rapid-feed', () => ({
  getRapidFeedResult,
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
  getRapidFeedResult.mockResolvedValue({
    feed: FEED,
    meta: { source: 'live', ageSeconds: 12, cacheAgeSeconds: 0 },
  });
  getRapidPublicCases.mockResolvedValue([]);
  usable.mockReturnValue(true);
});

describe('GET /api/ice-rapid', () => {
  it('serves the normalized feed with a long stale window and provenance headers', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('stale-while-revalidate=86400');
    expect(response.headers.get('cache-control')).toContain('stale-if-error=86400');
    expect(response.headers.get('x-ice-feed-source')).toBe('live');
    expect(response.headers.get('x-ice-feed-age')).toBe('12');
    expect(response.headers.get('x-ice-feed-cache-age')).toBe('0');
    expect(await response.json()).toMatchObject({ alerts: FEED.alerts, publicCases: [] });
  });

  it.each([
    ['memory', 14, 3],
    ['durable', 7_200, 300],
  ] as const)('labels a %s response with its feed and cache age', async (source, age, cacheAge) => {
    getRapidFeedResult.mockResolvedValue({
      feed: FEED,
      meta: { source, ageSeconds: age, cacheAgeSeconds: cacheAge },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('x-ice-feed-source')).toBe(source);
    expect(response.headers.get('x-ice-feed-age')).toBe(String(age));
    expect(response.headers.get('x-ice-feed-cache-age')).toBe(String(cacheAge));
  });

  it('answers 503 without poisoning the edge cache when every source is unavailable', async () => {
    usable.mockReturnValue(false);
    getRapidFeedResult.mockResolvedValue({
      feed: { ...FEED, alerts: [], officialReleases: [] },
      meta: { source: 'live', ageSeconds: 0, cacheAgeSeconds: 0 },
    });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('retry-after')).toBe('5');
    expect(response.headers.get('x-ice-feed-source')).toBe('live');
  });
});
