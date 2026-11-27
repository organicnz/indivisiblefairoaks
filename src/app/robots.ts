import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { IS_PRODUCTION_SITE, siteUrl } from '@/config/site';
import { isCrawlableHost } from '@/config/staging-guard';

// Paths with no public content. Written without trailing slashes because
// `Disallow: /account/` does NOT cover `/account` — Google then records the URL as
// "Indexed, though blocked by robots.txt" instead of honouring the noindex tag.
//
// These are also covered by `X-Robots-Tag` (next.config.ts) and/or a page-level
// `robots` directive. Blocking in robots.txt *and* noindexing is the one
// genuinely contradictory combination: a crawler that may not fetch the page can
// never see the noindex, so the URL is retained forever as a bare result. For
// noindexable surfaces we therefore let crawlers fetch and read the directive.
const DISALLOW = ['/api/'];

// Read the request host rather than only the build flag. `IS_PRODUCTION_SITE`
// becomes true for *every* host on the Production deployment at the apex
// cutover, including `test.indivisiblefairoaks.org`; the host is the only thing
// that still distinguishes them. See `src/config/staging-guard.ts`.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host');

  if (!isCrawlableHost({ host, isProductionSite: IS_PRODUCTION_SITE })) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOW,
      },
    ],
    sitemap: siteUrl('/sitemap.xml'),
    host: siteUrl('/'),
  };
}
