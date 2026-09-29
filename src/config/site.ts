import { env } from '@/lib/env';

// Single source of truth for site identity. Everything that needs to know
// "where does this site live" reads from here: metadataBase, canonicals,
// Open Graph, sitemap, robots.txt, JSON-LD, and the email templates.
//
// Why this exists: canonical URLs, `og:url`, `sitemap.xml` and `robots.txt` were
// each independently derived — and independently wrong. The root layout hardcoded
// the apex while robots/sitemap read the env var, so the staging host advertised
// apex canonicals that 302'd to a third-party site. Deriving all of them from one
// env value means an apex cutover is a single Vercel env change, not a code sweep.

/** The canonical production origin. Never derived from env — this IS the target. */
export const PRODUCTION_SITE_URL = 'https://indivisiblefairoaks.org';

/**
 * The origin this build is serving. Drives metadataBase, canonicals, sitemap and
 * robots so staging and previews are self-referential instead of claiming the apex.
 */
export const SITE_URL = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');

/**
 * True only when this build serves the production apex. Non-production builds
 * (preview, staging) emit `noindex, nofollow` so they can never compete with the
 * apex in the SERP or accumulate crawl signals against it.
 *
 * Note the flip: while staging runs on `test.indivisiblefairoaks.org`, the apex is
 * still a redirect to the legacy Google Site, so noindexing staging is the correct
 * state. At cutover, point `NEXT_PUBLIC_SITE_URL` at the apex and this becomes true
 * with no code change.
 */
export const IS_PRODUCTION_SITE = SITE_URL === PRODUCTION_SITE_URL;

export const SITE_NAME = 'Indivisible Fair Oaks-Carmichael';

export const SITE_DESCRIPTION =
  'Indivisible Fair Oaks-Carmichael is a non-violent grassroots movement defending democracy, resisting authoritarianism, electing progressive leaders, and advocating for our community.';

export const SITE_SHORT_DESCRIPTION =
  'A grassroots chapter representing residents in Fair Oaks and Carmichael, CA, committed to defending democratic norms and progressive change.';

export const SITE_TAGLINE = 'Grassroots Democracy in Action';

/** Root-relative helper so call sites never concatenate slashes by hand. */
export function siteUrl(path = '/'): string {
  return path === '/' ? SITE_URL : `${SITE_URL}/${path.replace(/^\/+/, '')}`;
}

/** Absolute URL for a public asset, resolved against the live origin. */
export function assetUrl(path: string): string {
  return siteUrl(path.startsWith('/') ? path : `/${path}`);
}

export const SITE_LOGO = {
  src: '/icon-512.png',
  width: 512,
  height: 512,
  alt: `${SITE_NAME} logo`,
};

/** Outbound profiles this chapter is genuinely affiliated with. Used for `sameAs`. */
export const SITE_SAME_AS = ['https://indivisible.org', 'https://indivisibleca.org'];

export const SITE_CONTACT = {
  email: 'contact@indivisiblefairoaks.org',
  subscribeEmail: 'subscribe@indivisiblefairoaks.org',
  /**
   * Meetings are held in Carmichael, CA (see Footer.tsx). No street address is
   * published — a residential meeting location is not something to put in
   * structured data, so only the locality is asserted.
   */
  locality: 'Carmichael',
  region: 'CA',
  regionName: 'California',
  country: 'US',
};

export const AREA_SERVED = [
  'Fair Oaks, California',
  'Carmichael, California',
  'Sacramento County, California',
];

/**
 * robots directives for a page. Centralised so `robots.txt`, meta tags and
 * `X-Robots-Tag` headers can never disagree — the three signals previously
 * conflicted (e.g. `/search` was both disallowed and noindex, which strands the
 * URL in search results forever).
 */
export const ROBOTS = {
  index: { index: true, follow: true },
  noindex: { index: false, follow: false },
  /** Noindex but let crawlers follow outbound links (e.g. internal search). */
  noindexFollow: { index: false, follow: true },
} as const;

/**
 * Robots policy for a non-production build. Staging and preview deployments must
 * never be indexed, otherwise they compete with the apex for the same queries.
 */
export function buildRobots(): { index: boolean; follow: boolean } {
  return IS_PRODUCTION_SITE ? ROBOTS.index : ROBOTS.noindex;
}

/** Root robots policy, including the staging noindex guard. */
export function rootRobots() {
  if (!IS_PRODUCTION_SITE) {
    return ROBOTS.noindex;
  }
  return ROBOTS.index;
}

/**
 * Organization entity. Emitted once at the root layout so every page carries the
 * chapter's identity — `logo`, `sameAs` and `areaServed` are what let a local
 * chapter resolve as a distinct entity from the national Indivisible network.
 */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'NGO',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: 'Indivisible FOC',
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: assetUrl(SITE_LOGO.src),
      width: SITE_LOGO.width,
      height: SITE_LOGO.height,
    },
    image: assetUrl(SITE_LOGO.src),
    description: SITE_SHORT_DESCRIPTION,
    email: SITE_CONTACT.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: SITE_CONTACT.locality,
      addressRegion: SITE_CONTACT.region,
      addressCountry: SITE_CONTACT.country,
    },
    areaServed: AREA_SERVED,
    knowsAbout: [
      'Grassroots organizing',
      'Voter registration',
      'Democratic resilience',
      'Non-violent direct action',
    ],
    parentOrganization: {
      '@type': 'Organization',
      name: 'Indivisible',
      url: 'https://indivisible.org',
    },
    sameAs: SITE_SAME_AS,
  };
}

/** WebSite entity with a SearchAction — the site has a real `/search` route. */
export function webSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    description: SITE_SHORT_DESCRIPTION,
    publisher: { '@id': `${SITE_URL}/#organization` },
    inLanguage: 'en-US',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
