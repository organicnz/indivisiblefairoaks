// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isSafeHref } from '@/components/admin/content/BlockEditor';
import { isLinkableHref } from '@/components/admin/content/LinkPopover';
import { sanitizeWPContent } from '@/lib/sanitize';
import { isTrustedHost, isTrustedLinkHref, TRUSTED_DOMAINS } from '@/lib/trusted-links';

/**
 * The outbound-link rule is enforced in two places that must agree: the
 * sanitizer drops an untrusted `<a>` at render, and the editor refuses it at the
 * point of entry so the author hears about it.
 *
 * They had already drifted. The sanitizer allowed twelve domains; `LinkPopover`
 * and `isSafeHref` each carried their own one-entry list, so a volunteer was
 * told their link to `indivisible.org` or `actblue.com` "will be removed when the
 * page is published" — for a link the sanitizer would have kept. Nothing failed,
 * because each copy was internally consistent.
 *
 * These tests are the property that stops it recurring: adding a domain to
 * `TRUSTED_DOMAINS` can no longer make the editor lag behind the sanitizer.
 */

/** Extract every href the sanitizer left in the output. */
function survivingHrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1] ?? '');
}

/**
 * The href is attribute-escaped before it goes into the fixture. Two of the
 * refusal cases contain markup (`data:text/html,<h1>x`) and one contains a space;
 * interpolated raw, the first injects a real `<h1>` element and splits the tag,
 * and the test then measures a parse accident rather than the href rule.
 */
function attrEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * The hrefs the sanitizer left behind, decoded.
 *
 * Note this is deliberately *not* "is there still an href attribute".
 * `javascript:` and `data:` both survive as `href="#"` — an inert placeholder
 * rather than a working link — so asserting on the attribute's presence would
 * report a neutralized URL as a kept one.
 */
function sanitizerWorkingHrefs(href: string): string[] {
  const out = sanitizeWPContent(`<a href="${attrEscape(href)}">link</a>`);
  return survivingHrefs(out)
    .map((h) =>
      h
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
    )
    .filter((h) => h !== '#');
}

const ACCEPTED = [
  { href: '/contact', why: 'site-relative' },
  { href: '#volunteer', why: 'fragment' },
  { href: 'mailto:organizer@indivisiblefairoaks.org', why: 'mailto' },
  { href: 'tel:+19165550143', why: 'tel' },
  { href: 'https://indivisiblefairoaks.org/news', why: 'the apex' },
  { href: 'https://www.indivisiblefairoaks.org/news', why: 'www of the apex' },
  { href: 'https://indivisible.org/fair-oaks', why: 'the national org' },
  { href: 'https://actblue.com/donate/xyz', why: 'a donation partner' },
  { href: 'https://mobilize.us/s/xyz', why: 'an action partner' },
  { href: 'https://givealittle.co.nz/1/2/3', why: 'a mission partner' },
];

/**
 * Refused because resolving them would be unsafe: an untrusted host, a lookalike
 * host, or a scheme that executes. The sanitizer must not leave a working link
 * for any of these.
 */
const REFUSED_UNSAFE = [
  { href: 'https://evil.example.com/steal', why: 'an untrusted host' },
  { href: 'https://indivisiblefairoaks.org.evil.com/', why: 'a lookalike host' },
  { href: '//evil.example.com', why: 'protocol-relative to an untrusted host' },
  { href: 'javascript:alert(1)', why: 'a script scheme' },
  { href: 'data:text/html,<h1>x', why: 'a data URL' },
  { href: 'ftp://indivisiblefairoaks.org', why: 'a non-http scheme' },
];

/**
 * Refused because the value is not a URL at all. The sanitizer leaves these as
 * relative hrefs — harmless, since they resolve against the current page and
 * 404 — so the editor being stricter here is the correct direction rather than a
 * divergence to fix.
 */
const REFUSED_NOT_A_URL = [
  { href: '', why: 'empty' },
  { href: 'not a url', why: 'junk' },
];

describe('the editor and the sanitizer agree on outbound links', () => {
  it.each(ACCEPTED)('accepts $why ($href) in the editor', ({ href }) => {
    expect(isLinkableHref(href)).toEqual({ ok: true });
    expect(isSafeHref(href)).toBe(true);
  });

  it.each(ACCEPTED)('and the sanitizer leaves the href working', ({ href }) => {
    expect(sanitizerWorkingHrefs(href)).toContain(href);
  });

  it.each([...REFUSED_UNSAFE, ...REFUSED_NOT_A_URL])('refuses $why ($href)', ({ href }) => {
    expect(isLinkableHref(href).ok).toBe(false);
    expect(isSafeHref(href)).toBe(false);
  });

  it.each(REFUSED_UNSAFE)('and the sanitizer leaves $why unusable', ({ href }) => {
    expect(sanitizerWorkingHrefs(href)).not.toContain(href);
  });

  it.each(REFUSED_NOT_A_URL)('leaves $why ($href) as no usable external link', ({ href }) => {
    // Documented divergence, in the safe direction. Whatever survives, it must
    // not be a trusted external destination.
    for (const value of sanitizerWorkingHrefs(href)) {
      expect(isTrustedLinkHref(value)).toBe(false);
    }
  });

  /**
   * The general property, over every domain on the list. This is the assertion
   * that fails if a domain is added to `TRUSTED_DOMAINS` while one of the call
   * sites keeps its own list — which is exactly how the two editor copies fell
   * eleven domains behind.
   */
  it('never diverges, for any host on the trusted list', () => {
    for (const domain of TRUSTED_DOMAINS) {
      const href = `https://${domain}/page`;
      expect({ domain, editorOk: isLinkableHref(href).ok, buttonOk: isSafeHref(href) }).toEqual({
        domain,
        editorOk: true,
        buttonOk: true,
      });
      expect(sanitizerWorkingHrefs(href)).toContain(href);
    }
  });

  it('rejects a host that merely contains a trusted domain', () => {
    // The suffix match must be on a dot boundary. A bare `endsWith` would accept
    // `notindivisiblefairoaks.org`, which is an attacker's domain.
    for (const host of [
      'notindivisiblefairoaks.org',
      'evil-indivisible.org',
      'indivisible.org.attacker.example',
      'xactblue.com',
    ]) {
      expect(isTrustedHost(host)).toBe(false);
      expect(isSafeHref(`https://${host}/`)).toBe(false);
      expect(sanitizerWorkingHrefs(`https://${host}/`)).not.toContain(`https://${host}/`);
    }
  });

  it('never tells an author a link will be removed when it will be kept', () => {
    // The message is part of the contract, and it was wrong for eleven of the
    // twelve domains. If a future edit narrows either side, this fails.
    for (const { href, why } of ACCEPTED) {
      expect({ href, why, result: isLinkableHref(href) }).toEqual({
        href,
        why,
        result: { ok: true },
      });
    }
  });
});
