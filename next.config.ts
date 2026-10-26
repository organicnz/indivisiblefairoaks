import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';
import { LEGACY_REDIRECTS } from './src/config/legacy-redirects';

// Supabase hostname is derived from the build-time env so a project restore
// or fork only needs a secret rotation — no code change.
const supabaseHost = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
})();

// Sentry ingest host derived from DSN env variable.
const sentryHost = (() => {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return '';
  try {
    return new URL(dsn).hostname;
  } catch {
    return '';
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
  `img-src 'self' data: blob: ${supabaseHost ? `https://${supabaseHost}` : ''} https://images.unsplash.com https://*.googleusercontent.com https://i.ytimg.com ${firstPartyHosts.map((h) => `https://${h}`).join(' ')} https://i0.wp.com https://i1.wp.com https://i2.wp.com`.replace(
    /\s+/g,
    ' '
  ),
  "font-src 'self' data:",
  `media-src 'self' data: blob: ${supabaseHost ? `https://${supabaseHost}` : ''} https://*.supabase.co https://*.s3.amazonaws.com https:`.replace(
    /\s+/g,
    ' '
  ),
  // Same-origin `/_vercel/*` covers the RUM beacons, so no extra origins needed.
  // Sentry ingest is dynamically allowed when DSN is configured.
  `connect-src 'self' ${supabaseHost ? `https://${supabaseHost}` : ''} https://api.stripe.com https://m.stripe.com ${sentryHost ? `https://${sentryHost}` : ''}`.replace(
    /\s+/g,
    ' '
  ),
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
  // (`tsrs` in the lint job, which build-e2e `needs`), and the
  // Sentry upload is already skipped without a token — so for e2e builds only:
  // skip the redundant type check, skip the Sentry wrapper entirely, and cap
  // build workers to fit the container (`experimental.cpus` is what
  // getNumberOfWorkers reads; the default otherwise follows host CPUs the
  // container does not have). Production builds (Vercel and local) keep all
  // three. See .github/workflows/ci.yml.
  compress: !isE2EBuild,
  staticPageGenerationTimeout: 180,
  typescript: {
    ignoreBuildErrors: isE2EBuild,
  },
  experimental: {
    exposeTestingApiInProductionBuild: isE2EBuild,
    ...(isE2EBuild ? { cpus: 1 } : {}),
    // TypeScript through the CLI, not the JavaScript compiler API.
    //
    // TypeScript 7 is the native (Go) compiler, and it does not ship
    // `lib/typescript.js` — the JS API Next's default type-check path loads
    // is simply gone. That was the reason this project was pinned to
    // TypeScript 5.9: "Next.js 16.3 loads TypeScript via the JS compiler API,
    // which was removed in TS 7.0."
    //
    // Next.js 16.4 has the other half of the answer. `useTypeScriptCli` runs
    // the `tsc` **binary** instead of the API, and it resolves that binary
    // from the `typescript` package's `bin` metadata.
    //
    // **The `typescript` package here is a shim, not the npm one.** See
    // `tools/typescript-shim/`. It is a package named `typescript` whose
    // `tsc` binary is backed by `tsrs`, the Rust port of the TypeScript 7
    // compiler, so the build's type check and the `bun run typecheck` gate
    // are the same compiler. The npm `typescript` package — a Go binary, and
    // never Node.js — is no longer in the dependency tree.
    //
    // This flag is `true` by default in Next 16.4, and it is set explicitly
    // anyway. It has to be: the shim has no `lib/typescript.js`, so the API
    // path would fail to find a compiler and the build would report a
    // missing dependency for a package that is present. A default that
    // silently flipped would break the build, and the failure would be a
    // dependency message rather than anything about type checking.
    //
    // The spawn is `process.execPath`, which under `bun --bun next build` is
    // the bun binary, so the CLI runs on Bun rather than needing a Node
    // runtime this project does not have.
    useTypeScriptCli: true,
    // Next.js 16.4's disk-cache garbage collector. Turbopack retains compiled
    // work for routes that no longer exist; this reclaims it, which matters on
    // a developer machine where `.next` is not a throwaway.
    turbopackGc: true,
    // Compile client-side dynamic imports only when the browser asks for them.
    // A page that lazily loads a heavy library — a chart, a PDF viewer — stops
    // paying for that library at build and at first paint.
    turbopackLazyDynamicImports: true,
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
