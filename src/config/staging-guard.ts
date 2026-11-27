/**
 * Host-conditional crawl policy.
 *
 * Why this exists
 * ---------------
 * `IS_PRODUCTION_SITE` in `src/config/site.ts` is a **build-time** comparison
 * between `NEXT_PUBLIC_SITE_URL` and the apex. It does not look at the request
 * host. `test.indivisiblefairoaks.org` and the apex serve the *same* Vercel
 * Production deployment, so the moment Production's env is pointed at the apex
 * — the apex cutover — that build reports `IS_PRODUCTION_SITE === true` on both
 * hosts. The apex should be indexable; the staging host must not be, and the
 * build flag can no longer tell them apart.
 *
 * So the staging guarantee is expressed twice, both keyed on the request host:
 *
 *   1. `stagingNoIndexRules()` is spread into `next.config.ts` `headers()` with
 *      `has: [{ type: 'host', value: STAGING_HOST }]`, emitting
 *      `X-Robots-Tag: noindex, nofollow` on every response from that host.
 *   2. `src/app/robots.ts` reads the request host and keeps `Disallow: /` on the
 *      staging host, which is exactly what it serves today.
 *
 * This module deliberately has **no imports**: `next.config.ts` cannot resolve
 * the `@/` alias, so it imports this file by relative path, and the same code
 * must also be importable from `src/`. It is pure so the behaviour can be tested
 * without a Next server — the tests are in
 * `src/lib/__tests__/staging-guard.test.ts` and
 * `src/lib/__tests__/robots-route.test.ts`.
 */

/** The staging host that must never be indexed. */
export const STAGING_HOST = 'test.indivisiblefairoaks.org';

/** The header value staging responses carry. */
export const STAGING_NO_INDEX = 'noindex, nofollow';

/** One `headers()` rule, structurally compatible with Next's `Header` type. */
export interface HostHeaderRule {
  source: string;
  has: { type: 'host'; value: string }[];
  headers: { key: string; value: string }[];
}

/**
 * The hostname from a `Host` header, lowercased and without its port.
 *
 * `new URL()` is the wrong tool here: a bare host header (`test.example.org`) is
 * not a URL without a scheme, and prefixing one would also accept userinfo and
 * paths that a Host header cannot legitimately carry. A trailing dot is a valid
 * fully-qualified spelling of the same host, so it is stripped.
 */
export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  let value = host.trim().toLowerCase();
  if (!value) return null;
  // `host:port`, but not an IPv6 literal — this guard names a DNS host and a
  // bracketed address can never equal it.
  if (!value.startsWith('[')) {
    const colon = value.indexOf(':');
    if (colon !== -1) value = value.slice(0, colon);
  }
  value = value.replace(/\.$/, '');
  return value.length > 0 ? value : null;
}

/**
 * True only for the exact staging hostname.
 *
 * An exact comparison, not `endsWith`: `test.indivisiblefairoaks.org.evil.com`
 * and `evil-test.indivisiblefairoaks.org` both end with the string and neither
 * is the staging host. The lookalike cases are pinned by tests.
 */
export function isStagingHost(host: string | null | undefined): boolean {
  return normalizeHost(host) === STAGING_HOST;
}

/**
 * Whether a request host may be crawled and indexed.
 *
 * Non-production builds stay `Disallow: /` (unchanged behaviour). On a
 * production build the apex and `www` are crawlable and the staging host is not.
 * An absent host keeps the production policy: it is only reachable outside a
 * real HTTP request (a build-time invocation), and the guard exists to separate
 * two real hosts, not to fail closed on an impossible request.
 */
export function isCrawlableHost({
  host,
  isProductionSite,
}: {
  host: string | null | undefined;
  isProductionSite: boolean;
}): boolean {
  if (!isProductionSite) return false;
  return !isStagingHost(host);
}

/**
 * The `headers()` rules that make staging non-indexable.
 *
 * Returned as an array so `next.config.ts` can spread it, and built here rather
 * than inline so a test can assert the matcher is host-scoped — a rule that lost
 * its `has` condition would noindex the apex too.
 */
export function stagingNoIndexRules(): HostHeaderRule[] {
  return [
    {
      source: '/:path*',
      has: [{ type: 'host', value: STAGING_HOST }],
      headers: [{ key: 'X-Robots-Tag', value: STAGING_NO_INDEX }],
    },
  ];
}
