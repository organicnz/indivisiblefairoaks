/**
 * The site's outbound-link rule, in one place.
 *
 * `sanitizeWPContent` drops an `<a>` whose href is not on this list, at render.
 * The editor has to apply the *same* rule at the point of entry, because the
 * alternative is an author who types a link, sees it render perfectly in the
 * editor, and finds it silently missing from the published page.
 *
 * ## Why this is a module and not three constants
 *
 * It was three, and they had already drifted. The sanitizer allowed twelve
 * domains. `LinkPopover` allowed one, and `isSafeHref` in `BlockEditor` allowed
 * one more copy of that one, hardcoded. So an author could not link to
 * `indivisible.org` (the national organization), `actblue.com` or
 * `mobilize.us` — all of which the sanitizer would have kept — and the editor
 * told them "External links are removed when the page is published", which was
 * false for eleven of the twelve.
 *
 * The failure mode of a duplicated allowlist is not a build error. It is a
 * volunteer quietly believing the site is more restrictive than it is, and
 * another one losing a link they could have kept. Both are worse than the thing
 * the list is for.
 *
 * Everything here is a pure function over a string, so the editor can import it
 * without pulling the sanitizer or its `sanitize-html` dependency into a client
 * bundle.
 */

export const TRUSTED_DOMAINS = [
  'indivisiblefairoaks.org',
  'i0.wp.com',
  'i1.wp.com',
  'i2.wp.com',
  'supabase.co',
  'stripe.com',
  'mobilize.us',
  'actblue.com',
  'indivisible.org',
  'indivisibleca.org',
  // Sister Indivisible chapters and the regional allies restored from the
  // chapter's Google Sites Links page (issue #150). Same class as
  // `indivisible.org` above: organizations the chapter vouches for by
  // publishing them, which an author may also reference from CMS bodies.
  'indivisiblesacramento.com',
  'indivisibleyolo.org',
  'indivisible-roseville-ca.org',
  'indivisibleeldorado.org',
  'indivisibleegt.com',
  '5calls.org',
  'norcalresist.org',
  'ardems.org',
  // Sea Cleaners mission partner (donation links live in CharitySection and CMS content).
  'seacleaners.org.nz',
  'givealittle.co.nz',
] as const;

/** Suffix match, so `www.` and subdomains of a trusted domain are covered. */
export function isTrustedHost(host: string): boolean {
  const normalized = host.trim().toLowerCase().replace(/\.$/, '');
  if (!normalized) return false;
  return TRUSTED_DOMAINS.some((d) => normalized === d || normalized.endsWith(`.${d}`));
}

/**
 * Whether a host may appear in an outbound link the CMS publishes.
 *
 * Takes a bare host so the sanitizer can reuse it for the two places it already
 * extracts one, without a second parse.
 */
export function isTrustedLinkHref(href: string): boolean {
  const value = href.trim();
  if (!value) return false;

  // Site-relative, fragment, and the two schemes that address no host.
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  if (value.startsWith('#')) return true;
  if (/^(mailto|tel):/i.test(value)) return true;

  // Protocol-relative. Treated as absolute: `//evil.com` is not a path, and the
  // sanitizer's own regex for this case matches the same way.
  const withoutScheme = value.replace(/^https?:\/\//i, '');
  if (withoutScheme.startsWith('//')) {
    const host = withoutScheme.slice(2).split(/[/?#]/)[0] ?? '';
    return isTrustedHost(stripPort(host));
  }

  if (!/^https?:\/\//i.test(value)) return false;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  return isTrustedHost(url.hostname);
}

function stripPort(host: string): string {
  // `URL.hostname` omits the port; the protocol-relative regex above does not.
  const at = host.lastIndexOf(':');
  if (at > 0 && /^\d*$/.test(host.slice(at + 1))) return host.slice(0, at);
  return host;
}

/**
 * The reason to show an author, or `null` when the href is fine.
 *
 * Wording is part of the contract: it must not claim a link *will* be removed
 * when the sanitizer would in fact have kept it.
 */
export function untrustedLinkReason(href: string): string | null {
  if (isTrustedLinkHref(href)) return null;
  const value = href.trim();
  if (!value) return 'Enter a link';
  if (value.startsWith('//')) {
    return 'Use a full https:// URL, or a path like /contact';
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'That is not a URL. Try https://… or /contact';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'Only http and https links are allowed';
  }
  return (
    'Links to other sites are removed when the page is published. ' +
    'Link to a page on this site instead.'
  );
}
