// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isLegacySlug } from '@/config/legacy-redirects';
import { ROUTES } from '@/config/routes';
import {
  CONTENT_TYPES,
  describeSlugConflict,
  MAX_BODY_BYTES,
  readingStats,
  slugifyTitle,
} from '@/lib/content';

describe('slugifyTitle', () => {
  it('produces a URL-safe slug', () => {
    expect(slugifyTitle('Carmichael Park Rally')).toBe('carmichael-park-rally');
    expect(slugifyTitle("  Voter's Guide  ")).toBe('voters-guide');
    expect(slugifyTitle('H.R. 1 — Stop It!')).toBe('h-r-1-stop-it');
  });

  it('strips accents rather than transliterating them', () => {
    // "café" must not become "caf" — a truncated slug is a different page.
    expect(slugifyTitle('Café Night')).toBe('cafe-night');
    expect(slugifyTitle('Zoë ñ')).toBe('zoe-n');
  });

  it('collapses runs of punctuation into single hyphens', () => {
    expect(slugifyTitle('a -- b')).toBe('a-b');
    expect(slugifyTitle('///slashes///')).toBe('slashes');
  });

  it('never emits a leading, trailing or doubled hyphen', () => {
    const slug = slugifyTitle('---Hello, World!---');
    expect(slug).toBe('hello-world');
    expect(slug.startsWith('-')).toBe(false);
    expect(slug.endsWith('-')).toBe(false);
    expect(slug).not.toContain('--');
  });

  it('stays within the 120 character limit the schema enforces', () => {
    const slug = slugifyTitle('word '.repeat(80));
    expect(slug.length).toBeLessThanOrEqual(120);
  });

  it('returns an empty string for input with nothing sluggable', () => {
    expect(slugifyTitle('!!!')).toBe('');
    expect(slugifyTitle('')).toBe('');
  });
});

describe('describeSlugConflict', () => {
  it('rejects every primary navigation path', () => {
    // A CMS row at /about is shadowed by the /about route segment: the page
    // saves, reports success, and is then unreachable at its own URL.
    for (const route of ROUTES) {
      const slug = route.href.replace(/^\//, '');
      if (!slug) continue; // "/" is not addressable as a slug
      expect(describeSlugConflict(slug), `/${slug} should be reserved`).toMatch(/already served/);
    }
  });

  it('rejects the other route groups and API surfaces', () => {
    for (const slug of ['admin', 'api', 'cart', 'products', 'search', 'wishlist', 'login']) {
      expect(describeSlugConflict(slug)).toMatch(/already served/);
    }
  });

  it('rejects legacy Google Sites paths whose 301 would win', () => {
    // next.config.ts serves these as permanent redirects, so a page here could
    // never be reached — and would be advertised twice in the sitemap.
    for (const slug of ['about-us', 'resistance-choir', 'voter-information', 'upcoming-events']) {
      expect(describeSlugConflict(slug), `/${slug} is a legacy redirect`).toMatch(/legacy/);
    }
  });

  it('agrees with the redirect map itself', () => {
    for (const slug of ['about-us', 'voter-information', 'newsletters', 'home']) {
      if (!isLegacySlug(slug)) continue;
      expect(describeSlugConflict(slug)).not.toBeNull();
    }
  });

  it('allows a normal CMS slug', () => {
    expect(describeSlugConflict('summer-rally')).toBeNull();
    expect(describeSlugConflict('carmichael-park-rally')).toBeNull();
  });
});

describe('readingStats', () => {
  it('counts words in the rendered text, not the markup', () => {
    // "Join us Saturday at noon" is five words; <strong> must not become a token.
    expect(readingStats('<p>Join us <strong>Saturday</strong> at noon</p>')).toEqual({
      words: 5,
      minutes: 1,
    });
  });

  it('returns zero for empty or markup-only input', () => {
    expect(readingStats('')).toEqual({ words: 0, minutes: 0 });
    expect(readingStats('<div></div>')).toEqual({ words: 0, minutes: 0 });
  });

  it('rounds to at least one minute for any real content', () => {
    // "0 min read" reads as broken rather than as brevity.
    expect(readingStats('<p>One</p>').minutes).toBe(1);
  });

  it('scales with length at 220 words per minute', () => {
    const long = `<p>${'word '.repeat(660).trim()}</p>`;
    expect(readingStats(long).words).toBe(660);
    expect(readingStats(long).minutes).toBe(3);
  });

  it('treats a non-breaking space as a word separator', () => {
    expect(readingStats('<p>one&nbsp;two&nbsp;three</p>').words).toBe(3);
  });
});

describe('content type vocabulary', () => {
  it('matches the CHECK constraint on content.type', () => {
    // The canonical schema constrains this column. If the two ever drift the
    // editor would offer a value the database rejects.
    expect([...CONTENT_TYPES].sort()).toEqual(['action', 'event', 'page', 'post']);
  });
});

describe('MAX_BODY_BYTES', () => {
  it('is a sane ceiling rather than a formality', () => {
    // 64 KiB is roughly 10,000 words — generous for a page, and a guard against
    // a runaway paste or a loop posting a megabyte into one row.
    expect(MAX_BODY_BYTES).toBe(64 * 1024);
    expect(MAX_BODY_BYTES).toBeLessThanOrEqual(256 * 1024);
  });
});
