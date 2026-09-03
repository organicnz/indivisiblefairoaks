import type { NextConfig } from 'next';

// Supabase hostname is derived from the build-time env so a project restore
// or fork only needs a secret rotation — no code change. Fallback preserves
// the current project when env is not set (e.g. type-check without .env).
const supabaseHost = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return 'wcoaqlglwxwceqktpckt.supabase.co';
  try {
    return new URL(url).hostname;
  } catch {
    return 'wcoaqlglwxwceqktpckt.supabase.co';
  }
})();

// Content-Security-Policy allowlist: everything the storefront actually talks to.
// 'unsafe-inline' on script-src is required because the static shell bakes inline
// JSON-LD + framework bootstrap scripts, which cannot carry per-request nonces.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://m.stripe.network.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${supabaseHost} https://images.unsplash.com https://*.googleusercontent.com https://i.ytimg.com https://indivisiblefairoaks.org https://i0.wp.com https://i1.wp.com https://i2.wp.com`,
  "font-src 'self' data:",
  `connect-src 'self' https://${supabaseHost} https://api.stripe.com https://m.stripe.network.com`,
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

// Keep crawlers out of non-content surfaces entirely — fewer index-driven
// crawl requests means fewer function invocations to pay for.
const noIndexPaths = ['/success', '/cancel', '/account', '/admin', '/wishlist'];

const routeHeaders = [
  { source: '/(.*)', headers: securityHeaders },
  ...noIndexPaths.map((source) => ({
    source,
    headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
  })),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return routeHeaders;
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
      {
        protocol: 'https',
        hostname: 'indivisiblefairoaks.org',
      },
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
  webpack(config) {
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: /\.wgsl$/,
      loader: '@vgpu/wgsl/loader-webpack',
    });
    return config;
  },
};

export default nextConfig;
