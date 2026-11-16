// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  extractCityState,
  extractFeedItems,
  extractHtmlReport,
  extractSameOriginLinks,
  extractStopIceReports,
  isIceReportText,
  readableText,
  verbatimExcerpt,
} from '@/lib/ice-crawl-extract';
import { isPrivateAddress } from '@/lib/ice-crawl';

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
  });

  it('finds same-origin links without external or fragment links', () => {
    const links = extractSameOriginLinks(
      '<a href="/one">One</a><a href="https://other.example/two">Two</a><a href="#three">Three</a><a href="/four#x">Four</a>',
      'https://example.org/seed'
    );
    expect(links).toEqual(['https://example.org/one', 'https://example.org/four']);
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
});
