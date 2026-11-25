// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildRelevancePattern,
  extractJusticeReleaseItems,
  isJusticeReleaseApi,
  justiceReleasePageUrls,
} from '@/lib/ice-crawl-justice';

const RELEASES = JSON.stringify({
  metadata: { resultset: { count: '276667', pagesize: 20, page: 0 } },
  results: [
    {
      url: 'https://www.justice.gov/opa/pr/ice-operation',
      title: 'ICE operation results in 40 arrests',
      body: '<p>U.S. Immigration and Customs Enforcement removed 40 noncitizens.</p>',
      teaser: 'ICE operation',
      date: '1795521600',
    },
    {
      url: 'https://www.justice.gov/opa/pr/justice-award',
      title: 'Department of Justice announces award',
      body: '<p>The Justice Department honored police officers and office staff.</p>',
      teaser: 'Award',
      date: '1795521600',
    },
    {
      url: 'https://www.justice.gov/opa/pr/immigration-fraud',
      title: 'Man sentenced for visa fraud and immigration benefit fraud',
      body: '<p>The defendant submitted false asylum documents.</p>',
      teaser: 'Fraud',
      date: '1795521600',
    },
    {
      url: 'https://evil.example.org/not-doj',
      title: 'ICE release on another host',
      body: '<p>immigration</p>',
      teaser: '',
      date: '1795521600',
    },
  ],
});

const TERMS = ['ICE', 'immigration', 'immigrant', 'asylum', 'visa fraud'];

describe('buildRelevancePattern', () => {
  it('matches acronyms and phrases on word boundaries', () => {
    const pattern = buildRelevancePattern(TERMS);
    expect(pattern?.test('ICE arrested someone')).toBe(true);
    expect(pattern?.test('immigrant rights')).toBe(true);
    expect(pattern?.test('immigration court')).toBe(true);
    expect(pattern?.test('Department of Justice award')).toBe(false);
    expect(pattern?.test('police office justice')).toBe(false);
  });

  it('returns null with no terms', () => {
    expect(buildRelevancePattern([])).toBeNull();
    expect(buildRelevancePattern(['  '])).toBeNull();
  });
});

describe('extractJusticeReleaseItems', () => {
  it('recognizes the release API shape', () => {
    expect(isJusticeReleaseApi(RELEASES)).toBe(true);
    expect(isJusticeReleaseApi('{"version":"https://jsonfeed.org/version/1"}')).toBe(false);
    expect(isJusticeReleaseApi('<html></html>')).toBe(false);
    expect(isJusticeReleaseApi('{"results":[]}')).toBe(false);
  });

  it('admits only beat-matched releases, and never another host', () => {
    const items = extractJusticeReleaseItems(RELEASES, TERMS);
    expect(items?.map((item) => item.url)).toEqual([
      'https://www.justice.gov/opa/pr/ice-operation',
      'https://www.justice.gov/opa/pr/immigration-fraud',
    ]);
    expect(items?.[0].date).toBe('2026-11-24T12:00:00.000Z');
  });

  it('does not admit a release whose beat term appears only in the body', () => {
    const bodyOnly = JSON.stringify({
      results: [
        {
          url: 'https://www.justice.gov/usao-x/pr/drug-conspiracy',
          title: 'Six indicted in a drug-trafficking conspiracy',
          teaser: 'Federal grand jury returns indictment',
          body: '<p>One defendant is a noncitizen facing removal proceedings.</p>',
          date: '1795521600',
        },
      ],
    });
    expect(extractJusticeReleaseItems(bodyOnly, TERMS)).toEqual([]);
  });

  it('admits nothing when the source has no relevance terms', () => {
    expect(extractJusticeReleaseItems(RELEASES, null)).toEqual([]);
    expect(extractJusticeReleaseItems(RELEASES, [])).toEqual([]);
  });

  it('returns null for a non-release document', () => {
    expect(extractJusticeReleaseItems('<html></html>', TERMS)).toBeNull();
  });
});

describe('justiceReleasePageUrls', () => {
  it('expands the seed into the first pages, preserving the descending sort', () => {
    const urls = justiceReleasePageUrls(
      'https://www.justice.gov/api/v1/press_releases.json?sort_by=created&sort_order=DESC',
      3
    );
    expect(urls).toHaveLength(3);
    for (const [index, url] of urls.entries()) {
      const parsed = new URL(url);
      expect(parsed.searchParams.get('page')).toBe(String(index));
      expect(parsed.searchParams.get('sort_by')).toBe('created');
      expect(parsed.searchParams.get('sort_order')).toBe('DESC');
    }
  });

  it('leaves every other source URL untouched', () => {
    expect(justiceReleasePageUrls('https://www.ice.gov/newsroom')).toEqual([
      'https://www.ice.gov/newsroom',
    ]);
  });
});
