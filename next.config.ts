import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';
import { LEGACY_REDIRECTS } from './src/config/legacy-redirects';

// Supabase hostname is derived from the build-time env so a project restore
// or fork only needs a secret rotation — no code change. Fallback preserves
// the current project when env is not set (e.g. type-check without .env).
const supabaseHost = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return 'mojsubkqjdruhpxbzgme.supabase.co';
  try {
    return new URL(url).hostname;
  } catch {
    return 'mojsubkqjdruhpxbzgme.supabase.co';
  }
})();

// Hosts that may serve first-party imagery. All three apex spellings are listed
// because CMS content migrated from Google Sites still references the bare apex
// while newer entries use the `www` and staging hosts — omitting one silently
// CSP-blocks those images in the browser.
const firstPartyHosts = [
  'indivisiblefairoaks.org',
  'www.indivisiblefairoaks.org',
  'test.indivisiblefairoaks.org',
];

// Content-Security-Policy allowlist: everything the storefront actually talks to.
// 'unsafe-inline' on script-src is required because the static shell bakes inline
// JSON-LD + framework bootstrap scripts, which cannot carry per-request nonces.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://m.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${supabaseHost} https://images.unsplash.com https://*.googleusercontent.com https://i.ytimg.com ${firstPartyHosts.map((h) => `https://${h}`).join(' ')} https://i0.wp.com https://i1.wp.com https://i2.wp.com`,
  "font-src 'self' data:",
  // Same-origin `/_vercel/*` covers the RUM beacons, so no extra origins needed.
  // Sentry ingest is the exception: the client SDK POSTs events there, and the
  // exact per-project host (not a wildcard) so a misconfigured DSN fails closed
  // instead of reporting somewhere unexpected.
  `connect-src 'self' https://${supabaseHost} https://api.stripe.com https://m.stripe.com https://o4509901022691328.ingest.de.sentry.io`,
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://js.stripe.com https://hooks.stripe.com https://secure.actblue.com https://www.mobilize.us",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
];

// Keep crawlers out of surfaces that have nothing to index. Matchers use `:path*`
// so nested routes are covered — a bare `/admin` source only matches the exact
// segment, so `/admin/orders` and `/admin/products` were never actually tagged.
//
// Deliberately NOT disallowed in robots.txt: blocking a URL and noindexing it are
// mutually defeating (a blocked URL is never fetched, so its noindex is never read,
// and the URL is retained as a bare search result). These surfaces are marked
// noindex via the header below and a page-level `robots` directive, which is the
// combination that actually works.
const noIndexPaths = [
  '/success',
  '/cancel',
  '/cart',
  '/login',
  '/wishlist',
  '/search',
  '/account/:path*',
  '/admin/:path*',
  '/auth/:path*',
];

const routeHeaders = [
  { source: '/(.*)', headers: securityHeaders },
  ...noIndexPaths.map((source) => ({
    source,
    headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
  })),
];

// Legacy Google Sites URLs. The chapter's site ran on Google Sites before this app;
// those paths are still linked from newsletters, printed flyers and search results.
// Each maps to its real equivalent here as a 301 so link equity transfers instead of
// landing the visitor on one of six near-duplicate CMS pages. The map lives in
// `src/config/legacy-redirects.ts` so runtime code can consult the same list when
// enumerating CMS slugs — the two cannot drift.
const legacyRedirects = LEGACY_REDIRECTS.map(({ source, destination, permanent }) => ({
  source,
  destination,
  permanent,
}));

// True only for the throwaway bundle CI builds for the browser suite
// (see the comment on `nextConfig` below). Never true on Vercel.
const isE2EBuild = process.env.NEXT_E2E_BUILD === 'true';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Fingerprinting aid, and one less header on every cached response.
  poweredByHeader: false,
  // The e2e bundle is a throwaway test fixture, never deployed — and it is
  // built on a 1024 MiB runner where Next's own phases measured 8.4 min
  // (Sentry runAfterProductionCompile) and 54+ min without finishing
  // (the built-in TypeScript check) on 2026-10-08. CI gates types separately
  // (`bunx tsc --noEmit` in the lint job, which build-e2e `needs`), and the
  // Sentry upload is already skipped without a token — so for e2e builds only:
  // skip the redundant type check, skip the Sentry wrapper entirely, and cap
  // build workers to fit the container (`experimental.cpus` is what
  // getNumberOfWorkers reads; the default otherwise follows host CPUs the
  // container does not have). Production builds (Vercel and local) keep all
  // three. See .github/workflows/ci.yml.
  typescript: {
    ignoreBuildErrors: isE2EBuild,
  },
  experimental: {
    exposeTestingApiInProductionBuild: isE2EBuild,
  },
  async headers() {
    return routeHeaders;
  },
  async redirects() {
    return legacyRedirects;
  },
  images: {
    // Cache transforms for 31 days — product photos rarely change, so repeat
    // views should never pay a second optimization. Cuts the transformations
    // quota burn dramatically (each unique width×image pair transforms once).
    minimumCacheTTL: 2678400,
    // Slim variant grids: fewer distinct widths = fewer cached transforms.
    deviceSizes: [640, 828, 1080, 1200, 1920],
    imageSizes: [64, 128, 256, 384],
    qualities: [75],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: supabaseHost,
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      // First-party media only. Previously a wide-open pattern on the bare apex
      // hostname with no pathname restriction, which let any path on the domain
      // be pulled through the image proxy.
      ...firstPartyHosts.flatMap((hostname) => [
        { protocol: 'https' as const, hostname, port: '', pathname: '/**' },
      ]),
      {
        protocol: 'https',
        hostname: 'i0.wp.com',
      },
      {
        protocol: 'https',
        hostname: 'i1.wp.com',
      },
      {
        protocol: 'https',
        hostname: 'i2.wp.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
    ],
  },
  turbopack: {
    rules: {
      '*.wgsl': {
        loaders: ['@vgpu/wgsl/loader-webpack'],
        as: '*.js',
      },
    },
  },
};

export default isE2EBuild
  ? nextConfig
  : withSentryConfig(nextConfig, {
      org: 'organicnz',
      project: 'indivisiblefairoaks-web',
      // Build-time source-map upload. The token is a CI/Vercel secret, never
      // inlined. E2e builds never reach this wrapper (see above), so a bundle
      // that is never deployed never uploads maps under the release its
      // production twin uses.
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Only print upload logs where someone reads CI output.
      silent: !process.env.CI,
      // Readable stack traces for minified client code.
      widenClientFileUpload: true,
    });
