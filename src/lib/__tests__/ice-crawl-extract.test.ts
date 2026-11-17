// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  extractCityState,
  extractFeedItems,
  extractHtmlReport,
  extractHtmlReports,
  extractJsonFeedItems,
  extractJsonFeedNextUrl,
  extractJsonLdArticles,
  extractNextLinks,
  extractSameOriginLinks,
  extractSitemapLinks,
  extractStopIceReports,
  isIceReportText,
  mergeExtractedReports,
  readableText,
  verbatimExcerpt,
  type ExtractedReport,
} from '@/lib/ice-crawl-extract';
import {
  chunkPageText,
  isPrivateAddress,
  parseAiJson,
  resolveCrawlUrls,
  splitAiChunk,
} from '@/lib/ice-crawl';
import type { CityPoint } from '@/components/ice-alerts/types';

const CITIES: CityPoint[] = [
  { city: 'San Diego', state: 'California', stateCode: 'CA', lat: 32.7, lng: -117.1, count: 1 },
  { city: 'Fort Myers', state: 'Florida', stateCode: 'FL', lat: 26.6, lng: -81.8, count: 1 },
  { city: 'Gateway', state: 'Florida', stateCode: 'FL', lat: 26.5, lng: -81.7, count: 1 },
  { city: 'Los Angeles', state: 'California', stateCode: 'CA', lat: 34.0, lng: -118.2, count: 1 },
];

describe('ice source extraction', () => {
  it('keeps readable source paragraphs and drops scripts', () => {
    const text = readableText(
      '<article><h1>ICE activity</h1><script>alert(1)</script><p>Agents were seen near Fair Oaks, CA.</p><p>They moved east.</p></article>'
    );
    expect(text).toContain('Agents were seen near Fair Oaks, CA.');
    expect(text).toContain('They moved east.');
    expect(text).not.toContain('alert');
    expect(text).toMatch(/Agents were seen[\s\S]*They moved east/);
  });

  it('extracts a full article report with city and kind', () => {
    const report = extractHtmlReport(
      '<html><head><title>ICE agents reported in Fair Oaks</title></head><body><article><p>Residents reported ICE agents and several vehicles near Fair Oaks, CA on Tuesday afternoon.</p><p>People were advised to stay back and document from a distance.</p></article></body></html>',
      'https://example.org/report'
    );
    expect(report).not.toBeNull();
    expect(report?.city).toBe('Fair Oaks');
    expect(report?.stateCode).toBe('CA');
    expect(report?.kind).toBe('enforcement');
    expect(report?.text).toContain('Residents reported ICE agents');
  });

  it('parses every report item from an RSS feed and ignores unrelated items', () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><title>ICE activity in Oakland</title><link>https://example.org/oakland</link><pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate><description><![CDATA[<p>People reported ICE agents and vehicles in Oakland, CA.</p>]]></description></item>
      <item><title>ICE checkpoint report</title><link>https://example.org/checkpoint</link><description>Drivers reported a checkpoint in Sacramento, CA.</description></item>
      <item><title>Library hours</title><link>https://example.org/library</link><description>The library is open late.</description></item>
    </channel></rss>`;
    const items = extractFeedItems(xml, 'https://example.org/feed.xml');
    expect(items).toHaveLength(2);
    expect(items[0]?.sourceUrl).toBe('https://example.org/oakland');
    expect(items[0]?.city).toBe('Oakland');
    expect(items[1]?.kind).toBe('checkpoint');
  });

  it('parses RSS 1.0 and Atom items that carry attributes', () => {
    const rss = `<rdf:RDF><item rdf:about="https://example.org/rss1"><title>ICE activity in Oakland</title><link>https://example.org/rss1</link><description>Residents reported ICE agents in Oakland, CA.</description></item></rdf:RDF>`;
    const atom = `<feed><entry xml:base="https://example.org/"><title>ICE checkpoint in Fresno</title><link href="https://example.org/atom1"/><summary>Drivers reported an ICE checkpoint in Fresno, CA.</summary></entry></feed>`;
    expect(extractFeedItems(rss, 'https://example.org/feed.rdf')).toHaveLength(1);
    expect(extractFeedItems(atom, 'https://example.org/atom.xml')).toHaveLength(1);
  });

  it('parses every StopICE custom report block with its source URL', () => {
    const xml = `<stopice_data>
      <report_data><id>1</id><location>Fair Oaks, CA</location><timestamp>nov 14, 2026 (21:00:02) PST</timestamp><comments><![CDATA[<p>Residents reported ICE agents and several vehicles near the intersection.</p>]]></comments><url>https://www.stopice.net/report/1</url></report_data>
      <report_data><id>2</id><location>Sacramento, CA</location><timestamp>nov 14, 2026 (22:00:00) PST</timestamp><comments><![CDATA[Drivers reported a checkpoint on the road.]]></comments><url>https://www.stopice.net/report/2</url></report_data>
    </stopice_data>`;
    const items = extractStopIceReports(xml, 'https://stopice.net/feed.xml');
    expect(items).toHaveLength(2);
    expect(items[0]?.sourceUrl).toBe('https://www.stopice.net/report/1');
    expect(items[0]?.city).toBe('Fair Oaks');
    expect(items[0]?.kind).toBe('enforcement');
    expect(items[1]?.kind).toBe('checkpoint');
    expect(items[0]?.publishedAt).toBe('2026-11-15T05:00:02.000Z');
  });

  it('accepts only verbatim AI excerpts', () => {
    const page = 'Residents reported ICE agents and vehicles near Fair Oaks, CA.';
    expect(verbatimExcerpt(page, 'ICE agents and vehicles near Fair Oaks, CA')).toBe(true);
    expect(verbatimExcerpt(page, 'ICE agents and vehicles')).toBe(true);
    expect(verbatimExcerpt(page, 'ICE agents arrested three people at a house')).toBe(false);
  });

  it('classifies report text and city/state conservatively', () => {
    expect(isIceReportText('ICE agents were reported near the library.')).toBe(true);
    expect(isIceReportText('The library is open late.')).toBe(false);
    expect(extractCityState('Activity in Sacramento, CA this morning')).toEqual({
      city: 'Sacramento',
      stateCode: 'CA',
    });
    expect(extractCityState('Activity in Sacramento, ZZ')).toEqual({
      city: null,
      stateCode: null,
    });
    expect(extractCityState('ice crashed in san diego ca')).toEqual({
      city: 'San Diego',
      stateCode: 'CA',
    });
  });

  it('uses the verified city snapshot for lowercase and address-style locations', () => {
    expect(extractCityState('san diego ca', CITIES)).toEqual({
      city: 'San Diego',
      stateCode: 'CA',
    });
    expect(
      extractCityState('4087 Palm Beach Blvd Fort Myers FL 33916 United States', CITIES)
    ).toEqual({ city: 'Fort Myers', stateCode: 'FL' });
    expect(extractCityState('FL82 and Owen Ave Gateway FL 33913', CITIES)).toEqual({
      city: 'Gateway',
      stateCode: 'FL',
    });
    expect(extractCityState('230 S Alvarado St Los Angeles Ca 90057', CITIES)).toEqual({
      city: 'Los Angeles',
      stateCode: 'CA',
    });
  });

  it('never borrows a same-named city from another state', () => {
    const cities: CityPoint[] = [
      ...CITIES,
      { city: 'Costa Mesa', state: 'California', stateCode: 'CA', lat: 33.6, lng: -117.9, count: 1 },
      { city: 'Gardena', state: 'California', stateCode: 'CA', lat: 33.8, lng: -118.3, count: 1 },
      { city: 'McAllen', state: 'Texas', stateCode: 'TX', lat: 26.2, lng: -98.2, count: 1 },
      { city: 'Houston', state: 'Texas', stateCode: 'TX', lat: 29.7, lng: -95.3, count: 1 },
      { city: 'Willowbrook', state: 'Illinois', stateCode: 'IL', lat: 41.7, lng: -87.9, count: 1 },
      { city: 'Boulevard', state: 'California', stateCode: 'CA', lat: 32.6, lng: -116.2, count: 1 },
      { city: "Dallas'", state: 'Texas', stateCode: 'TX', lat: 32.7, lng: -96.8, count: 1 },
    ];

    expect(extractCityState('Willowbrook CA 90061', cities)).toEqual({
      city: null,
      stateCode: 'CA',
    });
    expect(extractCityState('15715 Crenshaw Boulevard Gardena CA 90249', cities)).toEqual({
      city: 'Gardena',
      stateCode: 'CA',
    });
    expect(extractCityState('974 W Houston Ave McAllen TX 78501', cities)).toEqual({
      city: 'McAllen',
      stateCode: 'TX',
    });
    expect(extractCityState('Costa MesaCA 92626', cities)).toEqual({
      city: 'Costa Mesa',
      stateCode: 'CA',
    });
    expect(extractCityState('Dallas TX 75252', cities)).toEqual({
      city: 'Dallas',
      stateCode: 'TX',
    });
    expect(extractCityState('Colden and Vermont 90044', cities)).toEqual({
      city: null,
      stateCode: null,
    });
  });

  it('finds same-origin links without external or fragment links', () => {
    const links = extractSameOriginLinks(
      '<a href="/one">One</a><a href="https://other.example/two">Two</a><a href="#three">Three</a><a href="/four#x">Four</a>',
      'https://example.org/seed'
    );
    expect(links).toEqual(['https://example.org/one', 'https://example.org/four']);
  });

  it('follows head pagination links as well as anchors', () => {
    const links = extractSameOriginLinks(
      '<link rel="next" href="/reports/page/2"><atom:link rel="next" href="/reports/page/4"><a href="/reports/page/3">Next</a>',
      'https://example.org/reports'
    );
    expect(links).toContain('https://example.org/reports/page/2');
    expect(links).toContain('https://example.org/reports/page/3');
    expect(links).toContain('https://example.org/reports/page/4');
    expect(
      extractNextLinks(
        '<atom:link rel="next" href="/feed?after=abc"><a rel="next" href="/feed?after=def">Next</a>',
        'https://example.org/feed.xml'
      )
    ).toEqual(['https://example.org/feed?after=abc', 'https://example.org/feed?after=def']);
  });

  it('extracts every article on a page and keeps the source page title', () => {
    const html = `<html><head><title>ICE reports — Example</title></head><body>
      <article><h1>Fair Oaks sighting</h1><p>Residents reported ICE agents and vehicles near Fair Oaks, CA on Tuesday afternoon.</p></article>
      <article><h1>ICE checkpoint in Sacramento</h1><p>Drivers reported an ICE checkpoint on Capitol Avenue in Sacramento, CA.</p></article>
    </body></html>`;
    const reports = extractHtmlReports(html, 'https://example.org/reports');
    expect(reports).toHaveLength(2);
    expect(reports.map((report) => report.title)).toEqual([
      'Fair Oaks sighting',
      'ICE checkpoint in Sacramento',
    ]);
    expect(reports.every((report) => report.sourceTitle === 'ICE reports — Example')).toBe(true);
    expect(reports.every((report) => report.sourceUrl === 'https://example.org/reports')).toBe(true);
  });

  it('extracts multiple JSON-LD article bodies', () => {
    const html = `<html><head><title>Syndicated ICE reports</title>
      <script type="application/ld+json">{"@graph":[
        {"@type":"NewsArticle","headline":"ICE activity in Oakland","articleBody":"Residents reported ICE agents and vehicles in Oakland, CA.","datePublished":"2026-11-10T12:00:00Z"},
        {"@type":"NewsArticle","headline":"ICE checkpoint in Fresno","articleBody":"Drivers reported an ICE checkpoint in Fresno, CA.","datePublished":"2026-11-11T12:00:00Z"}
      ]}</script></head><body></body></html>`;
    expect(extractJsonLdArticles(html)).toHaveLength(2);
    const reports = extractHtmlReports(html, 'https://example.org/syndicated');
    expect(reports).toHaveLength(2);
    expect(reports[0]?.publishedAt).toBe('2026-11-10T12:00:00.000Z');
    expect(reports.every((report) => report.sourceTitle === 'Syndicated ICE reports')).toBe(true);
  });

  it('parses JSON Feed items without dropping their source URLs', () => {
    const json = JSON.stringify({
      version: 'https://jsonfeed.org/version/1.1',
      items: [
        {
          id: '1',
          url: 'https://example.org/oakland-json',
          title: 'ICE activity in Oakland',
          content_text: 'Residents reported ICE agents and vehicles in Oakland, CA.',
          date_published: '2026-11-10T12:00:00Z',
        },
        {
          id: '2',
          url: 'https://example.org/library-json',
          title: 'Library hours',
          content_text: 'The library is open late.',
        },
      ],
    });
    const items = extractJsonFeedItems(json, 'https://example.org/feed.json');
    expect(items).toHaveLength(1);
    expect(items[0]?.sourceUrl).toBe('https://example.org/oakland-json');
    expect(items[0]?.city).toBe('Oakland');
    expect(items[0]?.sourceTitle).toBe('ICE activity in Oakland');
    expect(
      extractJsonFeedNextUrl(
        JSON.stringify({ version: 'https://jsonfeed.org/version/1.1', next_url: '/feed?page=2' }),
        'https://example.org/feed.json'
      )
    ).toBe('https://example.org/feed?page=2');
  });

  it('extracts sitemap locations and ignores other origins', () => {
    const links = extractSitemapLinks(
      '<urlset><url><loc>https://example.org/reports/one</loc></url><url><loc><![CDATA[https://example.org/reports/two]]></loc></url><url><loc>https://other.example/two</loc></url></urlset>',
      'https://example.org/sitemap.xml'
    );
    expect(links).toEqual([
      'https://example.org/reports/one',
      'https://example.org/reports/two',
    ]);
  });

  it('deduplicates overlapping chunk extracts without dropping distinct reports', () => {
    const base: Omit<ExtractedReport, 'text' | 'title'> = {
      sourceUrl: 'https://example.org/reports',
      publishedAt: null,
      city: null,
      stateCode: null,
      kind: 'other',
      sourceTitle: 'ICE reports',
    };
    const merged = mergeExtractedReports(
      [{ ...base, title: 'Fair Oaks', text: 'Residents reported ICE agents near Fair Oaks, CA.' }],
      [
        { ...base, title: 'Duplicate', text: 'ICE agents near Fair Oaks, CA.' },
        {
          ...base,
          title: 'Sacramento checkpoint',
          text: 'Drivers reported an ICE checkpoint in Sacramento, CA.',
        },
      ]
    );
    expect(merged).toHaveLength(2);
    expect(merged[1]?.title).toBe('Sacramento checkpoint');
  });

  it('replaces a short AI excerpt with the complete article text', () => {
    const base: Omit<ExtractedReport, 'text' | 'title'> = {
      sourceUrl: 'https://example.org/reports',
      publishedAt: null,
      city: null,
      stateCode: null,
      kind: 'other',
      sourceTitle: 'ICE reports',
    };
    const excerpt = 'ICE agents were seen near Fair Oaks, CA.';
    const full = `${excerpt} Several residents said the vehicles left toward Madison Avenue.`;
    const merged = mergeExtractedReports(
      [{ ...base, title: 'Fair Oaks', text: excerpt }],
      [{ ...base, title: 'Fair Oaks', text: full }]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.text).toBe(full);
  });

  it('chunks long pages so the tail is still sent to the model', () => {
    const text = Array.from(
      { length: 120 },
      (_, index) => `Paragraph ${index}: ICE agents were reported near Fair Oaks, CA.`
    ).join('\n\n');
    const chunks = chunkPageText(text, 1_000, 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain('Paragraph 0');
    expect(chunks.join(' ')).toContain('Paragraph 119');
    expect(chunks.every((chunk) => chunk.length >= 40)).toBe(true);
  });

  it('splits an output-truncated AI chunk with overlap instead of dropping it', () => {
    const text = Array.from(
      { length: 80 },
      (_, index) => `Paragraph ${index}: ICE agents were reported near Fair Oaks, CA.`
    ).join('\n\n');
    const halves = splitAiChunk(text);
    expect(halves).not.toBeNull();
    expect(halves?.[0]).toContain('Paragraph 0');
    expect(halves?.[1]).toContain('Paragraph 79');
    expect((halves?.[0]?.length ?? 0) > 0 && (halves?.[1]?.length ?? 0) > 0).toBe(true);
  });

  it('parses fenced arrays, wrapped report objects, and JSONL model output', () => {
    expect(
      parseAiJson('```json\n[{"title":"A","text":"ICE agents were reported."}]\n```')
    ).toHaveLength(1);
    expect(
      parseAiJson('Here is the result: {"reports":[{"title":"B","text":"ICE checkpoint reported."}]}')
    ).toHaveLength(1);
    expect(
      parseAiJson(
        '{"title":"C","text":"ICE agents reported."}\n{"title":"D","text":"ICE checkpoint reported."}'
      )
    ).toHaveLength(2);
    expect(
      parseAiJson(
        JSON.stringify([
          { title: 'E', text: 'The report quoted {"title":"not a report"} verbatim.' },
        ])
      )
    ).toHaveLength(1);
    expect(
      parseAiJson(
        '{"data":{"reports":[{"title":"F","text":"ICE agents reported."}]}}'
      )
    ).toHaveLength(1);
  });
});

describe('crawler SSRF boundary', () => {
  it('rejects local, private, link-local, and metadata addresses', () => {
    expect(isPrivateAddress('127.0.0.1')).toBe(true);
    expect(isPrivateAddress('10.0.0.4')).toBe(true);
    expect(isPrivateAddress('192.168.1.2')).toBe(true);
    expect(isPrivateAddress('169.254.169.254')).toBe(true);
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('fd00::1')).toBe(true);
  });

  it('allows a public address', () => {
    expect(isPrivateAddress('203.0.113.10')).toBe(false);
    expect(isPrivateAddress('2001:4860:4860::8888')).toBe(false);
  });

  it('resolves the StopICE home source to its monthly exports', () => {
    expect(resolveCrawlUrls('https://stopice.net/?data=1', new Date('2026-11-16T12:00:00Z'))).toEqual([
      'https://stopice.net/login/data/stats/stopicenet_nov_2026_complete.xml',
      'https://stopice.net/login/data/stats/stopicenet_oct_2026_complete.xml',
      'https://stopice.net/login/data/stats/stopicenet_sep_2026_complete.xml',
    ]);
    expect(resolveCrawlUrls('https://example.org/feed.xml')).toEqual([
      'https://example.org/feed.xml',
    ]);
  });
});
