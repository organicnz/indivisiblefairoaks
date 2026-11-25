// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  buildGdeltDiscoveryUrl,
  canonicalizeDiscoveryUrl,
  decodeEntities,
  dedupeCandidates,
  discoveryRelevance,
  discoveryStoryKey,
  extractEvidenceImageUrls,
  extractTitle,
  isPrivateAddress,
  mentionsIceEnforcement,
  parseBingNewsPayload,
  parseGdeltArticles,
  parseMastodonPayload,
  parseNewsFeedPayload,
  readableText,
  withinDiscoveryWindow,
} from '../../../supabase/functions/_shared/ice-scan-logic';

describe('ice scan discovery normalization', () => {
  it('canonicalizes tracking parameters, fragments and the www prefix', () => {
    expect(
      canonicalizeDiscoveryUrl(
        'https://www.example.com/ice/raid/?utm_source=newsletter&b=2&fbclid=x#top'
      )
    ).toBe('https://example.com/ice/raid?b=2');
  });

  it('rejects insecure, credential-bearing and aggregator URLs', () => {
    expect(canonicalizeDiscoveryUrl('http://example.com/ice')).toBeNull();
    expect(canonicalizeDiscoveryUrl('https://user:pass@example.com/ice')).toBeNull();
    expect(canonicalizeDiscoveryUrl('https://news.google.com/rss/articles/x')).toBeNull();
    expect(canonicalizeDiscoveryUrl('https://example.com/report.pdf')).toBeNull();
  });

  it('collapses syndicated copies with the same headline and day', () => {
    const first = discoveryStoryKey(
      'ICE arrests 12 in California - CBS News',
      'CBS News',
      '2026-11-18T12:00:00.000Z'
    );
    const second = discoveryStoryKey(
      'ICE arrests 12 in California',
      'CBS News',
      '2026-11-18T18:00:00.000Z'
    );
    expect(first).toBe(second);
    expect(first).toBe('ice arrests 12 in california|2026-11-18');
    expect(
      discoveryStoryKey('ICE arrests 12 in California', 'CBS News', '2026-11-19T12:00:00.000Z')
    ).not.toBe(first);
  });

  it('keeps enforcement leads and rejects the frozen-water meaning', () => {
    expect(mentionsIceEnforcement('ICE agents arrested 12 people in a raid')).toBe(true);
    expect(mentionsIceEnforcement('Police arrested a man for assault')).toBe(false);
    expect(mentionsIceEnforcement('The ice cream shop opened on Main Street')).toBe(false);
    expect(
      mentionsIceEnforcement('Agentes de inmigración detienen a migrantes en una redada')
    ).toBe(true);
  });

  it('sees enforcement terms below the first 10k characters of a long page', () => {
    expect(
      mentionsIceEnforcement(`${'background '.repeat(1500)} ICE agents arrested two people.`)
    ).toBe(true);
  });

  it('requires a specific report signal before spending an AI call', () => {
    expect(discoveryRelevance('ICE operation', 'ICE agents detained three people.')).toBe(true);
    expect(
      discoveryRelevance('About ICE', 'Immigration and Customs Enforcement is an agency.')
    ).toBe(false);
  });

  it('drops candidates older than the discovery window', () => {
    const candidate = {
      url: 'https://example.com/ice',
      title: 'ICE arrests',
      publisher: null,
      published_at: '2026-01-01T00:00:00.000Z',
      discovery_query: 'test',
    };
    expect(withinDiscoveryWindow(candidate, Date.parse('2026-11-25T00:00:00Z'))).toBe(false);
    expect(
      withinDiscoveryWindow(
        { ...candidate, published_at: '2026-11-24T00:00:00.000Z' },
        Date.parse('2026-11-25T00:00:00Z')
      )
    ).toBe(true);
  });

  it('deduplicates by canonical URL and normalized headline', () => {
    const rows = dedupeCandidates([
      {
        url: 'https://example.com/a?utm_source=x',
        title: 'ICE arrests 2',
        publisher: 'Example',
        published_at: null,
        discovery_query: 'one',
      },
      {
        url: 'https://example.com/a',
        title: 'ICE arrests 2 - Example',
        publisher: 'Example',
        published_at: null,
        discovery_query: 'two',
      },
    ]);
    expect(rows).toHaveLength(1);
  });
});

describe('ice scan provider parsing', () => {
  it('parses GDELT articles, filters non-US sources and decodes entities', () => {
    const rows = parseGdeltArticles(
      JSON.stringify({
        articles: [
          {
            url: 'https://www.example.com/ice-raid?utm_source=gdelt',
            title: 'ICE raid &amp; arrests in Fresno',
            seendate: '20261124T120000Z',
            domain: 'example.com',
            sourcecountry: 'US',
          },
          {
            url: 'https://example.co.uk/ice-raid',
            title: 'ICE raid in London',
            sourcecountry: 'UK',
          },
          {
            url: 'https://news.google.com/rss/articles/x',
            title: 'ICE raid',
            sourcecountry: 'US',
          },
        ],
      })
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].url).toBe('https://example.com/ice-raid');
    expect(rows[0].title).toBe('ICE raid & arrests in Fresno');
    expect(rows[0].published_at).toBe('2026-11-24T12:00:00.000Z');
    expect(rows[0].discovery_query).toBe('nationwide-ice');
  });

  it('records the regional GDELT query that produced a candidate', () => {
    const rows = parseGdeltArticles(
      JSON.stringify({
        articles: [
          {
            url: 'https://example.com/ice-raid',
            title: 'ICE raid in Fresno',
            seendate: '20261124T120000Z',
            sourcecountry: 'US',
          },
        ],
      }),
      'ICE raid California'
    );
    expect(rows[0].discovery_query).toBe('ICE raid California');
  });

  it('resolves Bing News redirect links to the publisher', () => {
    const xml = `<?xml version="1.0"?><rss><channel><item>
      <title>ICE arrests 3 at a checkpoint</title>
      <link>https://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fexample.com%2Fice-arrests&amp;c=1</link>
      <description>Federal agents arrested three people.</description>
      <pubDate>Mon, 24 Nov 2026 12:00:00 GMT</pubDate>
      <News:Source>Example News</News:Source>
    </item></channel></rss>`;
    const rows = parseBingNewsPayload(xml, 'ICE arrests');
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toBe('https://example.com/ice-arrests');
    expect(rows[0].publisher).toBe('Example News');
    expect(rows[0].discovery_query).toBe('bing:ICE arrests');
  });

  it('keeps only enforcement items from an outlet feed', () => {
    const xml = `<rss><channel>
      <item><title>ICE raid in Sacramento</title><link>https://example.com/raid</link><description>Agents detained five people.</description></item>
      <item><title>New ice cream shop opens</title><link>https://example.com/ice-cream</link><description>A sweet story.</description></item>
    </channel></rss>`;
    const rows = parseNewsFeedPayload(xml, { id: 'example', label: 'Example' });
    expect(rows).toHaveLength(1);
    expect(rows[0].publisher).toBe('Example');
  });

  it('skips sensitive and duplicate Mastodon statuses', () => {
    const payload = [
      {
        content: '<p>ICE agents arrested two people at a checkpoint.</p>',
        url: 'https://mastodon.social/@a/1',
        created_at: '2026-11-24T12:00:00.000Z',
        account: { acct: 'a' },
      },
      {
        content: '<p>ICE agents arrested two people at a checkpoint.</p>',
        url: 'https://mastodon.social/@b/2',
        account: { acct: 'b' },
        sensitive: true,
      },
    ];
    const rows = parseMastodonPayload(payload, 'StopICE');
    expect(rows).toHaveLength(1);
    expect(rows[0].publisher).toBe('@a');
  });

  it('builds a bounded GDELT query URL', () => {
    const url = new URL(buildGdeltDiscoveryUrl('ICE raid'));
    expect(url.searchParams.get('mode')).toBe('ArtList');
    expect(url.searchParams.get('maxrecords')).toBe('250');
    expect(url.searchParams.get('query')).toBe('ICE raid');
  });
});

describe('ice scan network boundary', () => {
  it('rejects IPv4-mapped, 6to4 and Teredo destinations', () => {
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateAddress('::ffff:7f00:1')).toBe(true);
    expect(isPrivateAddress('2002:7f00:1::')).toBe(true);
    expect(isPrivateAddress('2001:0:4136:e378::1')).toBe(true);
    expect(isPrivateAddress('2606:4700:4700::1111')).toBe(false);
  });
});

describe('ice scan page extraction', () => {
  it('strips scripts and site chrome from readable text', () => {
    const text = readableText(
      '<html><script>alert(1)</script><body><h1>ICE raid</h1><p>Agents arrested two people.</p></body></html>'
    );
    expect(text).toContain('ICE raid');
    expect(text).toContain('Agents arrested two people.');
    expect(text).not.toContain('alert');
  });

  it('reads the title and the publisher preview image', () => {
    const html = `<!doctype html><html><head>
      <title>ICE raid in Fresno</title>
      <meta property="og:image" content="/images/raid.jpg">
      <meta property="og:description" content="Agents detained five people.">
    </head><body><p>Report body.</p></body></html>`;
    expect(extractTitle(html)).toBe('ICE raid in Fresno');
    expect(extractEvidenceImageUrls(html, 'https://example.com/story', 1)).toEqual([
      'https://example.com/images/raid.jpg',
    ]);
  });

  it('refuses insecure evidence image URLs', () => {
    const html = `<meta property="og:image" content="http://example.com/plain.jpg">
      <meta property="og:image" content="https://example.com/secure.jpg">`;
    expect(extractEvidenceImageUrls(html, 'https://example.com/story', 3)).toEqual([
      'https://example.com/secure.jpg',
    ]);
  });

  it('decodes numeric and named entities', () => {
    expect(decodeEntities('ICE &#38; CBP &amp; &quot;agents&quot;')).toBe('ICE & CBP & "agents"');
  });
});
