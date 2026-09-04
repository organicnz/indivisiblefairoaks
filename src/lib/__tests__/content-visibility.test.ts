import { describe, expect, it } from 'vitest';
import { buildTextSearchOr, buildVisibilityFilter } from '../queries/content';

describe('buildVisibilityFilter', () => {
  const now = '2026-09-04T00:00:00.000Z';

  it('builds a PostgREST or-fragment covering null and past embargoes', () => {
    expect(buildVisibilityFilter(now)).toBe(`published_at.is.null,published_at.lte.${now}`);
  });

  it('embeds the caller-supplied timestamp verbatim', () => {
    const other = '2027-01-01T12:00:00.000Z';
    expect(buildVisibilityFilter(other)).toContain(other);
  });

  it('never matches a future embargo (documents the SQL-side contract)', () => {
    // The fragment is `lte`, so a row with published_at > now is excluded by
    // PostgREST. This test pins the operator choice against regressions.
    const fragment = buildVisibilityFilter(now);
    expect(fragment).toContain('published_at.lte.');
    expect(fragment).not.toContain('gte');
  });
});

describe('buildTextSearchOr', () => {
  const now = '2026-09-04T00:00:00.000Z';

  it('conjoins each text condition with the visibility filter in one param', () => {
    expect(buildTextSearchOr(['title.ilike.%choir%', 'body.ilike.%choir%'], now)).toBe(
      `and(title.ilike.%choir%,published_at.is.null,published_at.lte.${now}),` +
        `and(body.ilike.%choir%,published_at.is.null,published_at.lte.${now})`
    );
  });

  it('handles a single text condition', () => {
    expect(buildTextSearchOr(['title.ilike.%x%'], now)).toBe(
      `and(title.ilike.%x%,published_at.is.null,published_at.lte.${now})`
    );
  });

  it('strips grouping characters from user input so queries cannot break out', () => {
    // "choir, meeting" must not become a third top-level or-branch.
    const fragment = buildTextSearchOr(['title.ilike.%choir, meeting%', 'body.ilike.%(x)%'], now);
    expect(fragment).toBe(
      `and(title.ilike.%choir meeting%,published_at.is.null,published_at.lte.${now}),` +
        `and(body.ilike.%x%,published_at.is.null,published_at.lte.${now})`
    );
  });

  it('drops conditions left empty after sanitizing', () => {
    expect(buildTextSearchOr(['(,)'], now)).toBe('');
  });
});
