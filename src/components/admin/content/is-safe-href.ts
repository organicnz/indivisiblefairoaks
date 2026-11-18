import { isTrustedLinkHref } from '@/lib/trusted-links';

/**
 * Mirrors the sanitizer's trusted-domain rule so the editor can warn early.
 *
 * The second of two hand-written copies of this, both of which listed only
 * `indivisiblefairoaks.org` while the sanitizer allowed twelve domains — so a
 * button pointing at `mobilize.us` or `actblue.com` raised a "this link will be
 * removed" warning for a link the sanitizer would have kept. The third copy is
 * gone; this is `isTrustedLinkHref` now.
 */
export function isSafeHref(href: string): boolean {
  return isTrustedLinkHref(href);
}
