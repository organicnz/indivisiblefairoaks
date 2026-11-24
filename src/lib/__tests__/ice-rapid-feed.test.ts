// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isAlertActive } from '@/components/ice-alerts/rapid-alert-utils';
import type { RapidFeedBase } from '@/components/ice-alerts/rapid-types';
import type { CityPoint } from '@/components/ice-alerts/types';
import {
  parseCommunityTimestamp,
  parseIceNewsroomRss,
  parseStopIceCommunityFeed,
} from '@/lib/ice-rapid-feed';

vi.mock('@/lib/queries/ice-heatmap', () => ({
  getIceHeatmapSnapshot: vi.fn(),
}));

vi.mock('@/lib/queries/ice-rapid-cache', () => ({
  readPersistedRapidFeed: vi.fn(),
  persistRapidFeed: vi.fn(),
}));

const CITIES: CityPoint[] = [
  {
    city: 'Santa Ana',
    state: 'CALIFORNIA',
    stateCode: 'CA',
    lat: 33.73633,
    lng: -117.8829,
    count: 2_243,
  },
  {
    city: 'Tustin',
    state: 'CALIFORNIA',
    stateCode: 'CA',
    lat: 33.74585,
    lng: -117.82617,
    count: 42,
  },
];

const COMMUNITY_XML = `<?xml version="1.0" encoding="utf-16" ?>
<stopice_data>
  <report_data>
    <id>1794718514043</id>
    <url>https://www.stopice.net/?alert=1794718514043</url>
    <lat>33.7504866</lat>
    <long>-117.8732255</long>
    <thispriority>URGENT Confirmed ICE report</thispriority>
    <location>62 Civic Center Plaza Santa Ana CA 92701</location>
    <timestamp>nov 14, 2026 (21:00:02) PST</timestamp>
    <comments>three ICE vehicles. Plate 8LHN072. Jane Doe was detained near the jail.</comments>
    <media>https://www.stopice.net/private/photo.jpeg</media>
  </report_data>
  <report_data>
    <id>1794700374214</id>
    <url>https://www.stopice.net/?alert=1794700374214</url>
    <lat>33.7199913</lat>
    <long>-117.8007892</long>
    <thispriority>ICE Sighting</thispriority>
    <location>14101 Myford Rd Tustin CA 92780</location>
    <timestamp>nov 14, 2026 (15:55:08) PST</timestamp>
    <comments>Checkpoint reported near the courthouse.</comments>
  </report_data>
  <report_data>
    <id>missing-city</id>
    <url>https://www.stopice.net/?alert=missing-city</url>
    <thispriority>ICE Sighting</thispriority>
    <location>Somewhere unknown</location>
    <timestamp>nov 14, 2026 (12:00:00) PST</timestamp>
    <comments>No state.</comments>
  </report_data>
</stopice_data>`;

const OFFICIAL_XML = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel>
  <item>
    <title><![CDATA[ICE Los Angeles arrests someone &amp; releases a statement]]></title>
    <link>https://www.ice.gov/news/releases/ice-los-angeles-example</link>
    <description><![CDATA[<p>On Nov. 10, ICE officers in Los Angeles <strong>arrested</strong> a person.</p>]]></description>
    <guid isPermaLink="false">70572</guid>
    <pubDate>Mon, 09 Nov 2026 15:57:26 -0500</pubDate>
  </item>
  <item>
    <title>Untrusted external link</title>
    <link>https://example.com/not-ice</link>
    <description>Not official.</description>
    <guid>bad</guid>
    <pubDate>Mon, 09 Nov 2026 15:57:26 -0500</pubDate>
  </item>
</channel></rss>`;

const PERSISTED_FEED: RapidFeedBase = {
  generatedAt: '2026-11-15T04:00:00.000Z',
  community: {
    status: 'ok',
    sourceName: 'Stop ICE Alerts Network',
    sourceUrl: 'https://stopice.net/login/data/stats/stopicenet_nov_2026_complete.xml',
    checkedAt: '2026-11-15T04:00:00.000Z',
    latestAt: '2026-11-15T03:00:00.000Z',
    itemCount: 1,
    note: 'Cached community snapshot.',
  },
  official: {
    status: 'ok',
    sourceName: 'ICE Newsroom',
    sourceUrl: 'https://www.ice.gov/newsroom',
    checkedAt: '2026-11-15T04:00:00.000Z',
    latestAt: '2026-11-09T20:57:26.000Z',
    itemCount: 1,
    note: 'Cached official snapshot.',
  },
  alerts: [
    {
      id: 'stopice-cached',
      source: 'community',
      sourceName: 'Stop ICE Alerts Network',
      sourceUrl: 'https://stopice.net/',
      kind: 'enforcement',
      status: 'sighting',
      title: 'Community enforcement report',
      city: 'Santa Ana',
      stateCode: 'CA',
      place: 'Santa Ana, CA',
      lat: 33.73633,
      lng: -117.8829,
      observedAt: '2026-11-15T03:00:00.000Z',
      expiresAt: '2026-11-15T07:00:00.000Z',
      description: 'Reporters described ICE activity in the area.',
      summary: 'Cached sighting in Santa Ana, CA.',
    },
  ],
  officialReleases: [
    {
      id: 'ice-cached',
      sourceName: 'ICE Newsroom',
      sourceUrl: 'https://www.ice.gov/news/releases/example',
      title: 'Enforcement arrest release',
      summary: 'Cached official release.',
      publishedAt: '2026-11-09T20:57:26.000Z',
    },
  ],
};

describe('parseCommunityTimestamp', () => {
  it('converts the export timestamp from Pacific time to UTC', () => {
    expect(parseCommunityTimestamp('nov 14, 2026 (21:00:02) PST')).toBe('2026-11-15T05:00:02.000Z');
  });

  it('rejects malformed timestamps', () => {
    expect(parseCommunityTimestamp('yesterday')).toBeNull();
    expect(parseCommunityTimestamp('nov 40, 2026 (21:00:02) PST')).toBeNull();
    expect(parseCommunityTimestamp('nov 14, 2026 (24:00:00) PST')).toBeNull();
    expect(parseCommunityTimestamp('nov 14, 2026 (21:60:00) PST')).toBeNull();
    expect(parseCommunityTimestamp('nov 14, 2026 (21:00:60) PST')).toBeNull();
  });
});

describe('active report freshness', () => {
  it('does not treat a future-dated report as active', () => {
    expect(
      isAlertActive(
        { observedAt: '2026-11-16T12:00:00.000Z' },
        Date.parse('2026-11-16T06:00:00.000Z')
      )
    ).toBe(false);
  });
});

describe('parseStopIceCommunityFeed', () => {
  it('generalizes locations and strips raw comments, plates, names, and media', () => {
    const result = parseStopIceCommunityFeed(COMMUNITY_XML, {
      cities: CITIES,
      now: new Date('2026-11-15T06:00:00.000Z'),
    });

    expect(result.alerts).toHaveLength(2);
    expect(result.scanned).toBe(3);
    expect(result.skipped).toBe(1);

    const santaAna = result.alerts[0];
    expect(santaAna.place).toBe('Santa Ana, CA');
    expect(santaAna.status).toBe('source-confirmed');
    expect(santaAna.kind).toBe('detention');
    expect(santaAna.summary).toBe(
      'Santa Ana, CA · Nov 14, 9:00 PM PST — source-confirmed detention-related activity near a jail or detention facility.'
    );
    expect(santaAna.summary).not.toContain('Civic Center');
    expect(santaAna.summary).not.toContain('8LHN072');
    expect(santaAna.summary).not.toContain('Jane Doe');
    expect(santaAna.description).toBe(
      'Reporters described multiple ICE vehicles near a jail or detention facility. Reporters said at least one person was taken into custody.'
    );
    expect(santaAna.description).not.toContain('Civic Center');
    expect(santaAna.description).not.toContain('8LHN072');
    expect(santaAna.description).not.toContain('Jane Doe');
    expect(santaAna.lat).toBe(CITIES[0].lat);
    expect(santaAna.lng).toBe(CITIES[0].lng);
    expect(santaAna.lat).not.toBe(33.7504866);
    expect(santaAna.lng).not.toBe(-117.8732255);

    const tustin = result.alerts[1];
    expect(tustin.place).toBe('Tustin, CA');
    expect(tustin.status).toBe('sighting');
    expect(tustin.kind).toBe('checkpoint');
    expect(tustin.summary).toBe(
      'Tustin, CA · Nov 14, 3:55 PM PST — community sighting of a possible checkpoint.'
    );
    expect(tustin.summary).not.toContain('courthouse');
    expect(tustin.summary).not.toContain('Myford');
    expect(tustin.description).toBe(
      'Reporters described a checkpoint or roadblock near a courthouse.'
    );
    expect(tustin.description).not.toContain('Myford');
    expect(tustin.description).not.toContain('14101');
  });

  it('drops reports that cannot be resolved to a city', () => {
    const result = parseStopIceCommunityFeed(COMMUNITY_XML, {
      cities: CITIES,
      now: new Date('2026-11-15T06:00:00.000Z'),
      limit: 1,
    });

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].id).toBe('stopice-1794718514043');
  });

  it('drops reports timestamped after the supplied now', () => {
    const futureXml = COMMUNITY_XML.replace(
      'nov 14, 2026 (21:00:02) PST',
      'nov 16, 2026 (21:00:02) PST'
    );
    const result = parseStopIceCommunityFeed(futureXml, {
      cities: CITIES,
      now: new Date('2026-11-15T06:00:00.000Z'),
    });

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].id).toBe('stopice-1794700374214');
  });

  it('forces an external report URL back to the public source home', () => {
    const unsafeXml = COMMUNITY_XML.replace(
      'https://www.stopice.net/?alert=1794718514043',
      'https://example.com/private/report'
    );
    const result = parseStopIceCommunityFeed(unsafeXml, {
      cities: CITIES,
      now: new Date('2026-11-15T06:00:00.000Z'),
    });

    expect(result.alerts[0].sourceUrl).toBe('https://stopice.net/');
  });
});

describe('parseIceNewsroomRss', () => {
  it('classifies official releases without republishing names or case details', () => {
    const result = parseIceNewsroomRss(OFFICIAL_XML);

    expect(result.releases).toHaveLength(1);
    const release = result.releases[0];
    expect(release.title).toBe('Enforcement arrest release');
    expect(release.summary).not.toContain('Los Angeles');
    expect(release.summary).not.toContain('arrested a person');
    expect(release.summary).not.toContain('<strong>');
    expect(release.sourceUrl).toMatch(/^https:\/\/www\.ice\.gov\//);
    expect(release.publishedAt).toBe('2026-11-09T20:57:26.000Z');
  });
});

describe('getRapidFeed', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let cacheModule: typeof import('@/lib/queries/ice-rapid-cache');
  let communityLastModified: string | null;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T06:00:00.000Z'));
    vi.resetModules();
    const heatmap = await import('@/lib/queries/ice-heatmap');
    vi.mocked(heatmap.getIceHeatmapSnapshot).mockResolvedValue({ cities: CITIES } as never);
    cacheModule = await import('@/lib/queries/ice-rapid-cache');
    vi.mocked(cacheModule.readPersistedRapidFeed).mockResolvedValue(null);
    vi.mocked(cacheModule.persistRapidFeed).mockResolvedValue(undefined);
    communityLastModified = new Date(Date.now() - 2 * 60 * 60 * 1000).toUTCString();
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (/stopicenet_[a-z]{3}_\d{4}_complete\.xml/.test(url)) {
        return new Response(COMMUNITY_XML, {
          status: 200,
          headers: communityLastModified ? { 'last-modified': communityLastModified } : {},
        });
      }
      if (url === 'https://www.ice.gov/rss/ice-breaking-news') {
        return new Response(OFFICIAL_XML, { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('loads the monthly export directly and overlaps both source requests', async () => {
    const { getRapidFeed } = await import('@/lib/ice-rapid-feed');
    const feed = await getRapidFeed();

    expect(feed.alerts).toHaveLength(2);
    expect(feed.officialReleases).toHaveLength(1);
    expect(feed.community.sourceUrl).toMatch(/stopicenet_nov_2026_complete\.xml$/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain(
      'https://stopice.net/?data=1'
    );
    expect(cacheModule.persistRapidFeed).toHaveBeenCalledWith(feed);
  });

  it('keeps a nightly export current when its newest report is older than the polling interval', async () => {
    vi.setSystemTime(new Date('2026-11-16T06:00:00.000Z'));
    communityLastModified = new Date('2026-11-16T04:00:00.000Z').toUTCString();

    const { getRapidFeed } = await import('@/lib/ice-rapid-feed');
    const feed = await getRapidFeed({ fresh: true });

    expect(feed.community.latestAt).toBe('2026-11-15T05:00:02.000Z');
    expect(feed.community.status).toBe('ok');
    expect(feed.community.note).not.toContain('Delayed community export');
  });

  it('labels a genuinely stale export file as delayed', async () => {
    vi.setSystemTime(new Date('2026-11-17T06:00:00.000Z'));
    communityLastModified = new Date('2026-11-15T04:00:00.000Z').toUTCString();

    const { getRapidFeed } = await import('@/lib/ice-rapid-feed');
    const feed = await getRapidFeed({ fresh: true });

    expect(feed.community.status).toBe('stale');
    expect(feed.community.note).toContain('the public data file has not updated since');
  });

  it('falls back to report age when the export exposes no Last-Modified header', async () => {
    vi.setSystemTime(new Date('2026-11-15T12:00:00.000Z'));
    communityLastModified = null;

    const { getRapidFeed } = await import('@/lib/ice-rapid-feed');
    const feed = await getRapidFeed({ fresh: true });

    expect(feed.community.status).toBe('stale');
    expect(feed.community.note).toContain('newest report is from');
  });

  it('deduplicates concurrent cold requests instead of refetching both sources', async () => {
    const { getRapidFeed } = await import('@/lib/ice-rapid-feed');
    const [first, second] = await Promise.all([getRapidFeed(), getRapidFeed()]);

    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports a live build with a cache age of zero', async () => {
    const { getRapidFeedResult } = await import('@/lib/ice-rapid-feed');
    const result = await getRapidFeedResult();

    expect(result.feed.alerts).toHaveLength(2);
    expect(result.meta.source).toBe('live');
    expect(result.meta.ageSeconds).toBeGreaterThanOrEqual(0);
    expect(result.meta.cacheAgeSeconds).toBe(0);
    expect(result.meta.refreshRecommended).toBe(false);
  });

  it('reports a memory hit and its age on the second request', async () => {
    const { getRapidFeedResult } = await import('@/lib/ice-rapid-feed');
    await getRapidFeedResult();
    vi.advanceTimersByTime(10_000);

    const result = await getRapidFeedResult();

    expect(result.meta.source).toBe('memory');
    expect(result.meta.ageSeconds).toBe(10);
    expect(result.meta.cacheAgeSeconds).toBe(10);
    expect(result.meta.refreshRecommended).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports a durable cache hit with the snapshot and cache ages', async () => {
    vi.mocked(cacheModule.readPersistedRapidFeed).mockResolvedValue({
      feed: PERSISTED_FEED,
      fetchedAt: '2026-11-15T05:55:00.000Z',
    });

    const { getRapidFeedResult } = await import('@/lib/ice-rapid-feed');
    const result = await getRapidFeedResult();

    expect(result.feed).toBe(PERSISTED_FEED);
    expect(result.meta.source).toBe('durable');
    expect(result.meta.ageSeconds).toBe(7_200);
    expect(result.meta.cacheAgeSeconds).toBe(300);
    expect(result.meta.refreshRecommended).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serves a stale durable snapshot immediately and recommends a background refresh', async () => {
    vi.mocked(cacheModule.readPersistedRapidFeed).mockResolvedValue({
      feed: PERSISTED_FEED,
      fetchedAt: '2026-11-15T05:44:00.000Z',
    });

    const { getRapidFeedResult } = await import('@/lib/ice-rapid-feed');
    const result = await getRapidFeedResult();

    expect(result.feed.alerts).toEqual(PERSISTED_FEED.alerts);
    expect(result.meta.source).toBe('durable');
    expect(result.meta.ageSeconds).toBe(7_200);
    expect(result.meta.cacheAgeSeconds).toBe(960);
    expect(result.meta.refreshRecommended).toBe(true);
    expect(result.feed.community.status).toBe('stale');
    expect(result.feed.official.status).toBe('stale');
    expect(result.feed.community.note).toContain('while a fresh snapshot is built');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a fresh persisted snapshot without touching upstream sources', async () => {
    vi.mocked(cacheModule.readPersistedRapidFeed).mockResolvedValue({
      feed: PERSISTED_FEED,
      fetchedAt: '2026-11-15T05:55:00.000Z',
    });

    const { getRapidFeed } = await import('@/lib/ice-rapid-feed');
    const feed = await getRapidFeed();

    expect(feed).toBe(PERSISTED_FEED);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rebuilds a persisted snapshot that predates community descriptions', async () => {
    const legacyAlert = { ...PERSISTED_FEED.alerts[0] };
    legacyAlert.description = undefined;
    vi.mocked(cacheModule.readPersistedRapidFeed).mockResolvedValue({
      feed: { ...PERSISTED_FEED, alerts: [legacyAlert] },
      fetchedAt: '2026-11-15T05:55:00.000Z',
    });

    const { getRapidFeed } = await import('@/lib/ice-rapid-feed');
    const feed = await getRapidFeed();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(feed.alerts[0]?.description).toContain('Reporters described');
  });

  it('revalidates upstream when a caller explicitly asks for a fresh feed', async () => {
    vi.mocked(cacheModule.readPersistedRapidFeed).mockResolvedValue({
      feed: PERSISTED_FEED,
      fetchedAt: '2026-11-15T05:55:00.000Z',
    });

    const { getRapidFeed } = await import('@/lib/ice-rapid-feed');
    const feed = await getRapidFeed({ fresh: true });

    expect(feed.alerts).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to the last good snapshot when both sources fail', async () => {
    vi.useRealTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(cacheModule.readPersistedRapidFeed).mockResolvedValue({
      feed: PERSISTED_FEED,
      fetchedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
    });
    fetchMock.mockResolvedValue(new Response('upstream unavailable', { status: 503 }));

    const { getRapidFeed } = await import('@/lib/ice-rapid-feed');
    const feed = await getRapidFeed({ fresh: true });

    expect(feed.alerts).toEqual(PERSISTED_FEED.alerts);
    expect(feed.officialReleases).toEqual(PERSISTED_FEED.officialReleases);
    expect(feed.community.status).toBe('stale');
    expect(feed.official.status).toBe('stale');
    expect(feed.community.note).toContain('last successful snapshot');
    expect(cacheModule.persistRapidFeed).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
