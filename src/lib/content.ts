import { isLegacySlug } from '@/config/legacy-redirects';
import { ROUTES } from '@/config/routes';

export const CONTENT_TYPES = ['page', 'post', 'action', 'event'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

/** 64 KiB is ~10,000 words — far more than any page on this site needs. */
export const MAX_BODY_BYTES = 64 * 1024;

/**
 * Paths that already resolve to a real App Router route.
 *
 * A CMS row with one of these slugs is shadowed by the route segment: the page
 * appears to save and then never appears at its own URL, which is a genuinely
 * baffling bug to chase. Rejected at write time instead, with the conflicting
 * path named.
 */
const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  ...ROUTES.map((route) => route.href.replace(/^\//, '')),
  // Route groups and API surfaces that are not in primary navigation.
  'account',
  'admin',
  'api',
  'auth',
  'cancel',
  'cart',
  'checkout',
  'donate',
  'faqs',
  'links',
  'login',
  'news',
  'privacy-policy',
  'products',
  'search',
  'shipping-returns',
  'success',
  'terms-and-conditions',
  'voter-info',
  'wishlist',
]);

/**
 * Derive a URL slug from a title. Shared with the editor so the value the author
 * previews before saving is the value that gets stored.
 */
export function slugifyTitle(title: string): string {
  return (
    title
      .normalize('NFKD')
      // Strip combining marks so "Café" becomes "cafe" rather than "caf".
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120)
  );
}

/**
 * Why a slug cannot be used, or null when it is fine.
 *
 * Two classes of conflict, both silent failures if left unchecked: a real App
 * Router segment shadowing the CMS route, and a legacy Google Sites path whose
 * 301 in next.config.ts would win over the live page.
 */
export function describeSlugConflict(slug: string): string | null {
  if (RESERVED_SLUGS.has(slug)) {
    return `/${slug} is already served by a site route. Pick a different slug.`;
  }
  if (isLegacySlug(slug)) {
    return `/${slug} is a legacy Google Sites path that permanently redirects elsewhere, so this page would never be reachable. Pick a different slug.`;
  }
  return null;
}

/** Word count and reading time for the editor's status readout. */
export function readingStats(html: string): { words: number; minutes: number } {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = text ? text.split(' ').length : 0;
  return { words, minutes: words === 0 ? 0 : Math.max(1, Math.round(words / 220)) };
}
