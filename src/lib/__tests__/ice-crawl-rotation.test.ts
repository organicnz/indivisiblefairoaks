// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { selectCrawlRotation } from '@/lib/ice-crawl';

type Source = { label: string; last_crawled_at: string | null };

const source = (label: string, last_crawled_at: string | null): Source => ({
  label,
  last_crawled_at,
});

describe('selectCrawlRotation', () => {
  it('returns every source when no limit is given', () => {
    const sources = [source('a', '2026-11-20T00:00:00Z'), source('b', null)];
    expect(selectCrawlRotation(sources).map((s) => s.label)).toEqual(['a', 'b']);
  });

  it('returns every source for a non-positive or non-finite limit', () => {
    const sources = [source('a', '2026-11-20T00:00:00Z'), source('b', null)];
    expect(selectCrawlRotation(sources, 0)).toHaveLength(2);
    expect(selectCrawlRotation(sources, -3)).toHaveLength(2);
    expect(selectCrawlRotation(sources, Number.NaN)).toHaveLength(2);
  });

  it('takes the least recently crawled sources first', () => {
    const sources = [
      source('recent', '2026-11-23T12:00:00Z'),
      source('oldest', '2026-11-18T20:00:00Z'),
      source('middle', '2026-11-21T09:00:00Z'),
      source('never', null),
    ];
    expect(selectCrawlRotation(sources, 2).map((s) => s.label)).toEqual(['never', 'oldest']);
  });

  it('rotates coverage across ticks instead of pinning one row', () => {
    const sources = [source('a', null), source('b', null), source('c', null)];
    const first = selectCrawlRotation(sources, 1);
    expect(first.map((s) => s.label)).toEqual(['a']);

    const afterFirst = sources.map((s) =>
      s.label === 'a' ? source('a', '2026-11-24T07:00:00Z') : s
    );
    expect(selectCrawlRotation(afterFirst, 1).map((s) => s.label)).toEqual(['b']);
  });

  it('floors and caps by at least one element', () => {
    const sources = [source('a', null), source('b', null)];
    expect(selectCrawlRotation(sources, 0.4)).toHaveLength(1);
    expect(selectCrawlRotation(sources, 99)).toHaveLength(2);
  });
});
