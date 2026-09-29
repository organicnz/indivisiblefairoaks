import { describe, expect, it } from 'vitest';
import { isLinkableHref } from '@/components/admin/content/LinkPopover';

/**
 * `isLinkableHref` is the editor's copy of `sanitizeWPContent`'s trusted-domain
 * rule. If the two ever disagree the author finds out by publishing: the link
 * looks fine in the editor and is then stripped from the page. These cases pin
 * the editor's side of that contract, and `sanitize.test.ts` pins the other.
 */
describe('isLinkableHref', () => {
  it('accepts site-relative paths', () => {
    expect(isLinkableHref('/contact')).toEqual({ ok: true });
    expect(isLinkableHref('/voter-info')).toEqual({ ok: true });
    expect(isLinkableHref('/news/2026/spring-rally')).toEqual({ ok: true });
  });

  it('accepts the apex and its subdomains over https', () => {
    expect(isLinkableHref('https://indivisiblefairoaks.org/about')).toEqual({ ok: true });
    expect(isLinkableHref('https://test.indivisiblefairoaks.org/')).toEqual({ ok: true });
    expect(isLinkableHref('http://indivisiblefairoaks.org')).toEqual({ ok: true });
  });

  it('rejects external hosts, which the sanitizer would strip on publish', () => {
    const result = isLinkableHref('https://example.com/page');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/removed when the page is published/);
  });

  it('rejects a lookalike host that merely contains the domain', () => {
    // The classic suffix-matching bug: `evil-indivisiblefairoaks.org` ends with the
    // string but is not the domain.
    expect(isLinkableHref('https://evil-indivisiblefairoaks.org').ok).toBe(false);
    expect(isLinkableHref('https://indivisiblefairoaks.org.evil.com').ok).toBe(false);
  });

  it('rejects protocol-relative URLs', () => {
    // `//evil.com` looks like a path but is a host. Accepting it would be a hole.
    const result = isLinkableHref('//example.com');
    expect(result.ok).toBe(false);
  });

  it('rejects non-http schemes', () => {
    for (const href of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
    ]) {
      expect(isLinkableHref(href).ok, href).toBe(false);
    }
  });

  it('accepts mailto, tel and in-page anchors', () => {
    expect(isLinkableHref('mailto:contact@indivisiblefairoaks.org')).toEqual({ ok: true });
    expect(isLinkableHref('tel:+19165550199')).toEqual({ ok: true });
    expect(isLinkableHref('#agenda')).toEqual({ ok: true });
  });

  it('rejects an empty value with an actionable message', () => {
    const result = isLinkableHref('   ');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('Enter a link');
  });

  it('rejects a bare word rather than guessing at a protocol', () => {
    const result = isLinkableHref('indivisiblefairoaks.org');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/not a URL/);
  });
});
