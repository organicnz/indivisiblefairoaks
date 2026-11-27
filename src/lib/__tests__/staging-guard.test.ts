// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  isCrawlableHost,
  isStagingHost,
  normalizeHost,
  STAGING_HOST,
  STAGING_NO_INDEX,
  stagingNoIndexRules,
} from '@/config/staging-guard';

describe('normalizeHost', () => {
  it('lowercases and strips a port', () => {
    expect(normalizeHost('TEST.IndivisibleFairOaks.org:443')).toBe(STAGING_HOST);
    expect(normalizeHost('indivisiblefairoaks.org:80')).toBe('indivisiblefairoaks.org');
  });

  it('trims whitespace and a trailing root dot', () => {
    expect(normalizeHost('  test.indivisiblefairoaks.org.  ')).toBe(STAGING_HOST);
  });

  it('returns null for an absent or empty host', () => {
    expect(normalizeHost(undefined)).toBeNull();
    expect(normalizeHost(null)).toBeNull();
    expect(normalizeHost('')).toBeNull();
    expect(normalizeHost('   ')).toBeNull();
  });
});

describe('isStagingHost', () => {
  it('matches only the exact staging hostname', () => {
    expect(isStagingHost(STAGING_HOST)).toBe(true);
    expect(isStagingHost(`${STAGING_HOST}:3000`)).toBe(true);
    expect(isStagingHost('indivisiblefairoaks.org')).toBe(false);
    expect(isStagingHost('www.indivisiblefairoaks.org')).toBe(false);
  });

  it('does not match lookalike hosts that contain the staging name', () => {
    // An `endsWith` check would pass every one of these.
    expect(isStagingHost(`${STAGING_HOST}.evil.example`)).toBe(false);
    expect(isStagingHost(`not-${STAGING_HOST}`)).toBe(false);
    expect(isStagingHost(`evil${STAGING_HOST}`)).toBe(false);
    expect(isStagingHost(`x.${STAGING_HOST}`)).toBe(false);
  });
});

describe('isCrawlableHost', () => {
  it('allows the apex and www on a production build', () => {
    expect(isCrawlableHost({ host: 'indivisiblefairoaks.org', isProductionSite: true })).toBe(true);
    expect(isCrawlableHost({ host: 'www.indivisiblefairoaks.org', isProductionSite: true })).toBe(
      true
    );
  });

  it('refuses the staging host even when the build says it is production', () => {
    // This is the apex-cutover case: one Production deployment, `IS_PRODUCTION_SITE`
    // true, and the request arriving on the staging domain.
    expect(isCrawlableHost({ host: STAGING_HOST, isProductionSite: true })).toBe(false);
    expect(
      isCrawlableHost({ host: 'test.indivisiblefairoaks.org:443', isProductionSite: true })
    ).toBe(false);
  });

  it('refuses every host on a non-production build', () => {
    expect(isCrawlableHost({ host: 'indivisiblefairoaks.org', isProductionSite: false })).toBe(
      false
    );
    expect(isCrawlableHost({ host: 'localhost:3031', isProductionSite: false })).toBe(false);
  });

  it('keeps the production policy when there is no host at all', () => {
    // Only reachable outside an HTTP request; a real request always has a Host.
    expect(isCrawlableHost({ host: undefined, isProductionSite: true })).toBe(true);
  });
});

describe('stagingNoIndexRules', () => {
  it('scopes the rule to the staging host rather than to every request', () => {
    const rules = stagingNoIndexRules();
    expect(rules).toHaveLength(1);

    const [rule] = rules;
    expect(rule.source).toBe('/:path*');
    // If `has` were dropped the apex would be noindexed too. Pin it exactly.
    expect(rule.has).toEqual([{ type: 'host', value: STAGING_HOST }]);
    expect(rule.headers).toEqual([{ key: 'X-Robots-Tag', value: STAGING_NO_INDEX }]);
  });

  it('covers nested paths such as the archive', () => {
    // `source: '/'` alone matches only the exact root; `/archive` must be tagged.
    expect(stagingNoIndexRules()[0]?.source).toBe('/:path*');
  });

  it('is wired into next.config.ts headers()', async () => {
    const config = (await import('../../../next.config')).default;
    expect(config.headers).toBeTypeOf('function');

    const headers = await config.headers?.();
    expect(headers).toEqual(
      expect.arrayContaining([
        {
          source: '/:path*',
          has: [{ type: 'host', value: STAGING_HOST }],
          headers: [{ key: 'X-Robots-Tag', value: STAGING_NO_INDEX }],
        },
      ])
    );
  });
});
