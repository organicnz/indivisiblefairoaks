// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  escapeIceSourceReportXml,
  serializeIceSourceReportsXml,
} from '@/lib/ice-source-report-export';
import type { IceSourceReport } from '@/lib/ice-crawl-types';

const REPORT: IceSourceReport = {
  id: 'report-1',
  source_name: 'Example Source',
  source_url: 'https://example.org/report?x=1&y=2',
  source_title: 'Source title',
  source_published_at: '2026-11-15T20:55:09.000Z',
  source_retrieved_at: '2026-11-16T19:00:00.000Z',
  title: 'Report <headline>',
  text_content: 'Line one & line two\nLine three "quoted".',
  city: 'Sacramento',
  state_code: 'CA',
  kind: 'enforcement',
  extraction_method: 'feed',
  published_at: '2026-11-16T19:00:01.000Z',
};

describe('source report XML export', () => {
  it('escapes XML metacharacters', () => {
    expect(escapeIceSourceReportXml(`<&>"'`)).toBe(
      '&lt;&amp;&gt;&quot;&apos;'
    );
  });

  it('includes attribution fields and readable source text', () => {
    const xml = serializeIceSourceReportsXml([REPORT], {
      generatedAt: '2026-11-16T20:00:00.000Z',
      filters: { query: 'sacramento', kind: 'enforcement', stateCode: 'CA' },
    });

    expect(xml).toContain('<source_name>Example Source</source_name>');
    expect(xml).toContain(
      '<source_url>https://example.org/report?x=1&amp;y=2</source_url>'
    );
    expect(xml).toContain('<source_published_at>2026-11-15T20:55:09.000Z</source_published_at>');
    expect(xml).toContain('<text_content>Line one &amp; line two');
    expect(xml).toContain('Line three &quot;quoted&quot;.');
    expect(xml).toContain('<filter name="query">sacramento</filter>');
    expect(xml).toContain('<filter name="state">CA</filter>');
  });

  it('emits empty optional elements instead of dropping fields', () => {
    const xml = serializeIceSourceReportsXml(
      [{ ...REPORT, source_title: null, city: null }],
      {
        generatedAt: '2026-11-16T20:00:00.000Z',
        filters: { query: '', kind: 'all', stateCode: '' },
      }
    );

    expect(xml).toContain('<source_title />');
    expect(xml).toContain('<city />');
  });
});
