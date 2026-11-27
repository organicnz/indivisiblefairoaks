// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestHost = vi.hoisted(() => ({ value: 'indivisiblefairoaks.org' }));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ host: requestHost.value }),
}));

const APEX = 'https://indivisiblefairoaks.org';
const STAGING = 'https://test.indivisiblefairoaks.org';

type Robots = {
  rules: { userAgent: string; allow?: string; disallow?: string | string[] }[];
  sitemap?: string;
  host?: string;
};

/**
 * Import the route after setting the build-time env, because `IS_PRODUCTION_SITE`
 * is computed when `src/config/site.ts` is evaluated. Both hosts are exercised
 * against the *same* production build — that is the post-cutover arrangement.
 */
async function loadRobots(siteUrl: string): Promise<Robots> {
  vi.resetModules();
  vi.stubEnv('NEXT_SKIP_ENV_VALIDATION', '1');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', siteUrl);
  const route = await import('@/app/robots');
  return (route.default as unknown as () => Promise<Robots>)();
}

describe('robots.txt host policy on a production build', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows crawling on the apex and advertises the apex sitemap', async () => {
    requestHost.value = 'indivisiblefairoaks.org';
    const robots = await loadRobots(APEX);

    expect(robots.rules).toEqual([{ userAgent: '*', allow: '/', disallow: ['/api/'] }]);
    expect(robots.sitemap).toBe(`${APEX}/sitemap.xml`);
    // `siteUrl('/')` returns the bare origin, not `origin/`.
    expect(robots.host).toBe(APEX);
  });

  it('allows crawling on www', async () => {
    requestHost.value = 'www.indivisiblefairoaks.org';
    const robots = await loadRobots(APEX);

    expect(robots.rules).toEqual([{ userAgent: '*', allow: '/', disallow: ['/api/'] }]);
    expect(robots.sitemap).toBe(`${APEX}/sitemap.xml`);
  });

  it('keeps Disallow: / on the staging host even when the build is production', async () => {
    // Before the host-aware guard this returned the apex policy — the exact
    // failure the cutover plan called out: the env flip makes staging indexable.
    requestHost.value = 'test.indivisiblefairoaks.org';
    const robots = await loadRobots(APEX);

    expect(robots.rules).toEqual([{ userAgent: '*', disallow: '/' }]);
    expect(robots.sitemap).toBeUndefined();
    expect(robots.host).toBeUndefined();
  });

  it('recognises the staging host with a port and in mixed case', async () => {
    requestHost.value = 'TEST.IndivisibleFairOaks.org:443';
    const robots = await loadRobots(APEX);

    expect(robots.rules).toEqual([{ userAgent: '*', disallow: '/' }]);
  });

  it('still disallows everything on a non-production build', async () => {
    requestHost.value = 'indivisiblefairoaks.org';
    const robots = await loadRobots(STAGING);

    expect(robots.rules).toEqual([{ userAgent: '*', disallow: '/' }]);
    expect(robots.sitemap).toBeUndefined();
  });
});
