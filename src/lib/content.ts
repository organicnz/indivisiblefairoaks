import { isLegacySlug } from '@/config/legacy-redirects';
import { ROUTES } from '@/config/routes';
import {
  copyRegionComposeHref,
  copyRegionLocationForSlug,
  isCopyRegionSlug,
} from '@/lib/copy-regions';

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

/** The minimum a row needs for its links to be resolved correctly. */
export interface ContentLinkRow {
  slug: string;
  status?: string | null;
}

/**
 * The URL a reader reaches this row at, or null when the row is not public.
 *
 * There are three ways `/${slug}` lies, and this helper is the one place that
 * knows all three:
 *
 * - **A copy region is not a page.** `copy-home-hero` is stored in `content`,
 *   but it renders inside `/`; its own path is filtered out of the sitemap and
 *   `[slug]` for exactly that reason. Linking it as a page produced a 200
 *   "Page Not Found" from the only row that actually drives the homepage.
 * - **A reserved or legacy slug is shadowed.** The coded route or the 301 in
 *   `next.config.ts` wins, so `/${slug}` opens something that is not this row.
 *   The workspace banner explains this; a View link should not contradict it.
 * - **A draft has no public page.** `getPublishedContent` filters it out, so the
 *   link lands on a 200 Not Found that reads like a typo.
 *
 * Returning null rather than a best guess is deliberate: the callers render no
 * View action at all, which is honest, instead of an action that goes nowhere.
 */
export function contentPublicHref(content: ContentLinkRow): string | null {
  if (content.status !== undefined && content.status !== 'publish') return null;
  const region = copyRegionLocationForSlug(content.slug);
  if (region) return region.path;
  if (isCopyRegionSlug(content.slug)) return null;
  if (describeSlugConflict(content.slug)) return null;
  return `/${content.slug}`;
}

/**
 * Where "Compose" opens for this row.
 *
 * A registered copy region opens its host page with that region selected — the
 * document an operator is actually editing — while everything else opens the
 * dedicated workspace. Both the content list and the editor call this, so the
 * rule cannot exist in one surface and not the other, which is how the region
 * rows ended up linking to a detached page nobody could act on.
 */
export function contentComposeHref(content: { id: number; slug: string }): string {
  return copyRegionComposeHref(content.slug) ?? `/compose/${content.id}`;
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
