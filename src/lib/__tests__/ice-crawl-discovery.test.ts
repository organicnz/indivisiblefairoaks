// @vitest-environment node
import { deflateRawSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildGdeltDiscoveryUrl,
  canonicalizeDiscoveryUrl,
  dedupeDiscoveryCandidates,
  discoveryStoryKey,
  discoverGdeltNationwideIceCandidates,
  discoverNationwideIceCandidates,
  mentionsIceEnforcement,
  parseBingNewsPayload,
  parseGdeltDiscoveryPayload,
  parseGdeltGkgPayload,
  parseMastodonPayload,
  parseNewsFeedPayload,
} from '@/lib/ice-crawl-discovery';

const payload = JSON.stringify({
  articles: [
    {
      url: 'https://www.example.com/ice/arrests?utm_source=newsletter&id=7',
      title: 'ICE arrests 12 in nationwide enforcement operation',
      domain: 'example.com',
      seendate: '20261118T120000Z',
      sourcecountry: 'United States',
    },
    {
      url: 'https://www.example.com/ice/arrests?utm_medium=social&id=7',
      title: 'ICE arrests 12 in nationwide enforcement operation',
      domain: 'example.com',
      seendate: '20261118T120000Z',
      sourcecountry: 'United States',
    },
    {
      url: 'https://facebook.com/example/posts/123',
      title: 'ICE arrests 12 in nationwide enforcement operation',
      domain: 'facebook.com',
      seendate: '20261118T120000Z',
      sourcecountry: 'United States',
    },
    {
      url: 'https://example.org/world/ice',
      title: 'ICE arrests 12 in nationwide enforcement operation',
      domain: 'example.org',
      seendate: '20261118T120000Z',
      sourcecountry: 'Canada',
    },
    {
      url: 'not-a-url',
      title: 'ICE arrests 12 in nationwide enforcement operation',
      domain: 'example.net',
      seendate: '20261118T120000Z',
    },
  ],
});

function gkgRow(overrides: { url?: string; locations?: string; title?: string } = {}) {
  const columns = Array<string>(27).fill('');
  columns[0] = '20261118061500-1';
  columns[1] = '20261118061500';
  columns[2] = '1';
  columns[3] = 'wtop.com';
  columns[4] = overrides.url ?? 'https://wtop.com/virginia/2026/11/ice-lawsuit/';
  columns[7] = 'TAX_FNCACT;TAX_FNCACT_AGENTS;WB_840_JUSTICE';
  columns[9] =
    overrides.locations ??
    '3#Norfolk, Virginia, United States#US#USVA#36.8468#-76.2852#1497051;1#United States#US#US#39.828175#-98.5795#US';
  columns[13] = 'U.S. IMMIGRATION AND CUSTOMS ENFORCEMENT';
  columns[23] = 'Immigration And Customs Enforcement';
  columns[26] =
    '<PAGE_PRECISEPUBTIMESTAMP>20261118020500</PAGE_PRECISEPUBTIMESTAMP>' +
    `<PAGE_TITLE>${overrides.title ?? 'Lawsuit accuses ICE of making arrests in Virginia &#x2013; WTOP News'}</PAGE_TITLE>`;
  return columns.join('\t');
}

function zipWithCsv(text: string) {
  const name = Buffer.from('test.gkg.csv');
  const compressed = deflateRawSync(Buffer.from(text));
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(8, 8);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(Buffer.byteLength(text), 22);
  header.writeUInt16LE(name.length, 26);
  return Buffer.concat([header, name, compressed]);
}

describe('nationwide ICE discovery', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a U.S.-only GDELT article query', () => {
    const url = new URL(buildGdeltDiscoveryUrl());
    expect(url.origin + url.pathname).toBe('https://api.gdeltproject.org/api/v2/doc/doc');
    expect(url.searchParams.get('mode')).toBe('ArtList');
    expect(url.searchParams.get('format')).toBe('json');
    expect(url.searchParams.get('maxrecords')).toBe('250');
    expect(url.searchParams.get('timespan')).toBe('3d');
    expect(url.searchParams.get('query')).toContain('sourcecountry:US');
    expect(url.searchParams.get('query')).toContain('sourcelang:english');
  });

  it('keeps one canonical U.S. article and filters social/foreign results', () => {
    const candidates = parseGdeltDiscoveryPayload(payload);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual({
      url: 'https://example.com/ice/arrests?id=7',
      title: 'ICE arrests 12 in nationwide enforcement operation',
      publisher: 'example.com',
      published_at: '2026-11-18T12:00:00.000Z',
      discovery_query: 'nationwide-ice',
    });
  });

  it('returns no candidates for malformed or empty responses', () => {
    expect(parseGdeltDiscoveryPayload('<html>busy</html>')).toEqual([]);
    expect(parseGdeltDiscoveryPayload('{"articles":[]}')).toEqual([]);
    expect(parseGdeltDiscoveryPayload('{"articles":"nope"}')).toEqual([]);
  });

  it('canonicalizes tracking parameters and fragments', () => {
    expect(
      canonicalizeDiscoveryUrl(
        'https://WWW.Example.com/ice/arrests/?utm_source=x&smid=social&b=2&a=1#top'
      )
    ).toBe('https://example.com/ice/arrests?a=1&b=2');
    expect(canonicalizeDiscoveryUrl('https://twitter.com/example/status/1')).toBeNull();
    expect(canonicalizeDiscoveryUrl('http://example.com/ice')).toBeNull();
  });

  it('deduplicates publisher-suffixed headlines and canonical URLs', () => {
    const candidates = dedupeDiscoveryCandidates([
      {
        url: 'https://example.com/ice/arrests',
        title: 'ICE arrests 12 in California raid',
        publisher: 'CBS News',
        published_at: '2026-11-18T12:00:00.000Z',
        discovery_query: 'rss:cbs',
      },
      {
        url: 'https://example.com/ice/arrests',
        title: 'ICE arrests 12 in California raid - CBS News',
        publisher: 'CBS News',
        published_at: '2026-11-18T12:00:00.000Z',
        discovery_query: 'bing:ICE arrests',
      },
      {
        url: 'https://example.com/ice/arrests?utm_source=newsletter',
        title: 'ICE arrests 12 in California raid',
        publisher: 'CBS News',
        published_at: '2026-11-18T12:00:00.000Z',
        discovery_query: 'bing:ICE arrests',
      },
    ]);

    expect(candidates).toHaveLength(1);
  });

  it('builds a stable story key that separates publication days', () => {
    expect(discoveryStoryKey('ICE arrests 12 in California', null, '2026-11-18T23:30:00.000Z')).toBe(
      'ice arrests 12 in california|2026-11-18'
    );
    expect(discoveryStoryKey('ICE arrests 12 in California', null, '2026-11-19T00:30:00.000Z')).toBe(
      'ice arrests 12 in california|2026-11-19'
    );
    expect(discoveryStoryKey('ICE arrests 12 in California', null, null)).toBe(
      'ice arrests 12 in california|'
    );
    expect(
      discoveryStoryKey(
        'ICE arrests 12 in California - CBS News',
        'CBS News',
        '2026-11-18T23:30:00.000Z'
      )
    ).toBe('ice arrests 12 in california|2026-11-18');
  });

  it('retries the GDELT plain-text rate-limit response once', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('Please limit requests to one every 5 seconds.', { status: 429 }))
      .mockResolvedValueOnce(new Response(payload, { status: 200 }));
    const sleep = vi.fn(async () => {});

    const result = await discoverGdeltNationwideIceCandidates({ fetchImpl, sleep });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(6_000);
    expect(result.candidates).toHaveLength(1);
    expect(result.errors).toEqual([]);
    expect(result.provider).toBe('gdelt-api');
    expect(result.providers).toEqual(['gdelt-api']);
  });

  it('parses only U.S.-located ICE enforcement rows from a GKG snapshot', () => {
    const candidates = parseGdeltGkgPayload(
      [
        gkgRow(),
        gkgRow({
          url: 'https://example.co.uk/ice-arrest',
          locations: '1#London, United Kingdom#GB#GB#51.5#-0.1#GB',
          title: 'ICE arrests man in London',
        }),
        gkgRow({
          url: 'https://example.com/ice-cream',
          title: 'ICE cream shop opens in Virginia',
        }),
      ].join('\n')
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      url: 'https://wtop.com/virginia/2026/11/ice-lawsuit/'.replace(/\/$/, ''),
      title: 'Lawsuit accuses ICE of making arrests in Virginia – WTOP News',
      publisher: 'wtop.com',
      published_at: '2026-11-18T02:05:00.000Z',
    });
  });

  it('falls back to the newest GKG archive when the article API is rate-limited', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('Please limit requests.', { status: 429 }))
      .mockResolvedValueOnce(new Response('Please limit requests.', { status: 429 }))
      .mockResolvedValueOnce(
        new Response('123 abc https://data.gdeltproject.org/gdeltv2/20261118061500.gkg.csv.zip', {
          status: 200,
        })
      )
      .mockResolvedValueOnce(new Response(zipWithCsv(gkgRow()), { status: 200 }));
    const sleep = vi.fn(async () => {});

    const result = await discoverGdeltNationwideIceCandidates({ fetchImpl, sleep });

    expect(result.provider).toBe('gdelt-gkg');
    expect(result.providers).toEqual(['gdelt-gkg']);
    expect(result.candidates).toHaveLength(1);
    expect(result.errors[0]).toContain('GDELT returned HTTP 429');
    expect(result.errors[0]).toContain('GKG snapshot');
  });

  it('distinguishes ICE enforcement from unrelated uses of the word ice', () => {
    expect(mentionsIceEnforcement('ICE cream shop opens in Virginia')).toBe(false);
    expect(mentionsIceEnforcement('Federal immigration agents arrest four workers')).toBe(true);
    expect(mentionsIceEnforcement('ICE raid reported in Fresno')).toBe(true);
    expect(mentionsIceEnforcement('Detención migratoria tras redadas de ICE')).toBe(true);
  });

  it('resolves Bing News links to the publisher and keeps enforcement coverage', () => {
    const xml = `
      <rss><channel>
        <item>
          <title>ICE arrests 8 in California raid</title>
          <link>https://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;url=https%3A%2F%2Fwww.nytimes.com%2F2026%2F11%2F18%2Fus%2Fice-arrests.html</link>
          <description>Agents detained workers at a Central Valley site.</description>
          <pubDate>Wed, 18 Nov 2026 12:00:00 GMT</pubDate>
          <News:Source>The New York Times</News:Source>
        </item>
        <item>
          <title>Ice cream shop opens in Sacramento</title>
          <link>https://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fexample.com%2Fice-cream</link>
          <description>A new dessert shop.</description>
          <pubDate>Wed, 18 Nov 2026 12:00:00 GMT</pubDate>
        </item>
      </channel></rss>`;

    const candidates = parseBingNewsPayload(xml, 'ICE raid');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual({
      url: 'https://nytimes.com/2026/11/18/us/ice-arrests.html',
      title: 'ICE arrests 8 in California raid',
      publisher: 'The New York Times',
      published_at: '2026-11-18T12:00:00.000Z',
      discovery_query: 'bing:ICE raid',
    });
  });

  it('parses direct major-outlet RSS and filters unrelated stories', () => {
    const xml = `
      <rss><channel>
        <item>
          <title>ICE detention center expands in California</title>
          <link>https://www.npr.org/2026/11/18/ice-detention-california</link>
          <description>Immigration detention beds increased.</description>
          <pubDate>Wed, 18 Nov 2026 12:00:00 GMT</pubDate>
        </item>
        <item>
          <title>New ice cream flavor arrives</title>
          <link>https://www.npr.org/2026/11/18/ice-cream</link>
          <description>A dessert story.</description>
          <pubDate>Wed, 18 Nov 2026 12:00:00 GMT</pubDate>
        </item>
      </channel></rss>`;

    const candidates = parseNewsFeedPayload(xml, { id: 'npr', label: 'NPR' });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      url: 'https://npr.org/2026/11/18/ice-detention-california',
      publisher: 'NPR',
      discovery_query: 'rss:npr',
    });
  });

  it('parses public Mastodon statuses and skips sensitive posts', () => {
    const payload = JSON.stringify([
      {
        url: 'https://mastodon.social/@witness/12345',
        content: '<p>ICE raid reported in Fresno. Witnesses are gathering safely.</p>',
        created_at: '2026-11-18T12:00:00.000Z',
        sensitive: false,
        account: { acct: 'witness' },
      },
      {
        url: 'https://mastodon.social/@witness/12346',
        content: '<p>ICE raid content marked sensitive.</p>',
        created_at: '2026-11-18T12:00:00.000Z',
        sensitive: true,
        account: { acct: 'witness' },
      },
    ]);

    const candidates = parseMastodonPayload(JSON.parse(payload), 'ICEraid');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      url: 'https://mastodon.social/@witness/12345',
      title: 'ICE raid reported in Fresno. Witnesses are gathering safely.',
      publisher: '@witness',
      discovery_query: 'mastodon:ICEraid',
    });
  });

  it('merges GDELT, Bing, RSS, and Mastodon providers', async () => {
    const bingXml = `
      <rss><channel>
        <item>
          <title>ICE arrests 8 in California raid</title>
          <link>https://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fwww.nytimes.com%2F2026%2F11%2F18%2Fice-arrests.html</link>
          <description>Agents detained workers.</description>
          <pubDate>Wed, 18 Nov 2026 12:00:00 GMT</pubDate>
          <News:Source>The New York Times</News:Source>
        </item>
      </channel></rss>`;
    const feedXml = `
      <rss><channel>
        <item>
          <title>ICE detention center expands in California</title>
          <link>https://www.npr.org/2026/11/18/ice-detention-california</link>
          <description>Immigration detention beds increased.</description>
          <pubDate>Wed, 18 Nov 2026 12:00:00 GMT</pubDate>
        </item>
      </channel></rss>`;
    const mastodonPayload = JSON.stringify([
      {
        url: 'https://mastodon.social/@witness/12345',
        content: '<p>ICE raid reported in Fresno.</p>',
        created_at: new Date().toISOString(),
        account: { acct: 'witness' },
      },
    ]);
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes('api.gdeltproject.org')) return new Response(payload, { status: 200 });
      if (url.includes('bing.com')) return new Response(bingXml, { status: 200 });
      if (url.includes('mastodon')) return new Response(mastodonPayload, { status: 200 });
      return new Response(feedXml, { status: 200 });
    });

    const result = await discoverNationwideIceCandidates({ fetchImpl });

    expect(result.provider).toBe('multi-source');
    expect(result.providers).toEqual(
      expect.arrayContaining(['gdelt-api', 'bing-news', 'rss', 'mastodon'])
    );
    expect(result.candidates.length).toBeGreaterThanOrEqual(4);
  });
});
