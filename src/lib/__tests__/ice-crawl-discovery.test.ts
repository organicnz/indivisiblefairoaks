// @vitest-environment node
import { deflateRawSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildGdeltDiscoveryUrl,
  canonicalizeDiscoveryUrl,
  discoverNationwideIceCandidates,
  parseGdeltDiscoveryPayload,
  parseGdeltGkgPayload,
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
      url: 'https://www.example.com/ice/arrests?id=7',
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
        'https://WWW.Example.com/ice/arrests/?utm_source=x&b=2&a=1#top'
      )
    ).toBe('https://www.example.com/ice/arrests?a=1&b=2');
    expect(canonicalizeDiscoveryUrl('https://twitter.com/example/status/1')).toBeNull();
    expect(canonicalizeDiscoveryUrl('http://example.com/ice')).toBeNull();
  });

  it('retries the GDELT plain-text rate-limit response once', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('Please limit requests to one every 5 seconds.', { status: 429 }))
      .mockResolvedValueOnce(new Response(payload, { status: 200 }));
    const sleep = vi.fn(async () => {});

    const result = await discoverNationwideIceCandidates({ fetchImpl, sleep });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(6_000);
    expect(result.candidates).toHaveLength(1);
    expect(result.errors).toEqual([]);
    expect(result.provider).toBe('gdelt-api');
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

    const result = await discoverNationwideIceCandidates({ fetchImpl, sleep });

    expect(result.provider).toBe('gdelt-gkg');
    expect(result.candidates).toHaveLength(1);
    expect(result.errors[0]).toContain('GDELT returned HTTP 429');
    expect(result.errors[0]).toContain('GKG snapshot');
  });
});
