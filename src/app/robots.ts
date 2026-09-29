import type { MetadataRoute } from 'next';
import { IS_PRODUCTION_SITE, siteUrl } from '@/config/site';

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

// Only meaningful on the production apex. On preview/staging the whole site is
// noindex, and advertising a sitemap there invites crawlers to waste requests.
export default function robots(): MetadataRoute.Robots {
  if (!IS_PRODUCTION_SITE) {
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
