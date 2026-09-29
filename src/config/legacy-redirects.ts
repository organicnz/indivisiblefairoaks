// Legacy Google Sites URL map, in a standalone module with no imports so it can be
// consumed from both `next.config.ts` (which cannot resolve the `@/` alias) and
// runtime code that needs to know which slugs are already handled.
//
// The chapter's site ran on Google Sites before this app. Those paths are still
// referenced from newsletters, printed flyers, and search results. Each maps to its
// real equivalent here as a 301, so link equity transfers instead of landing the
// visitor on one of six near-duplicate CMS pages — the CMS migration copied Google
// Sites' navigation chrome into the page body, so `/voter-information` and
// `/voter-info` were both live, both indexable, and both carrying the same content.

export type LegacyRedirect = {
  /** Legacy path, always leading-slashed and without a trailing slash. */
  source: string;
  destination: string;
  permanent: true;
};

export const LEGACY_REDIRECTS: readonly LegacyRedirect[] = [
  { source: '/about-us', destination: '/about', permanent: true },
  { source: '/resistance-choir', destination: '/choir', permanent: true },
  { source: '/voter-information', destination: '/voter-info', permanent: true },
  { source: '/upcoming-events', destination: '/events', permanent: true },
  { source: '/upcoming-fall-events', destination: '/events', permanent: true },
  { source: '/newsletters', destination: '/news', permanent: true },
  { source: '/coalition-links', destination: '/links', permanent: true },
  { source: '/home', destination: '/', permanent: true },
  { source: '/good-trouble', destination: '/news', permanent: true },
  { source: '/weekend-of-protest-song', destination: '/choir', permanent: true },
] as const;

/** Slugs owned by a 301 above. A CMS row with one of these is unreachable. */
export const LEGACY_SLUGS: ReadonlySet<string> = new Set(
  LEGACY_REDIRECTS.map((redirect) => redirect.source.replace(/^\//, ''))
);

/** True when this path is served by a legacy redirect rather than a real route. */
export function isLegacySlug(slug: string): boolean {
  return LEGACY_SLUGS.has(slug);
}
