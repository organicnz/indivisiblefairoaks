/**
 * Regression tests for the sanitizeWPContent hardening (XSS bypass closes):
 * unquoted attributes, protocol-relative links, subdomain-aware trust,
 * nested-markup spam, style vectors, and active-content elements.
 *
 * Each test below locks a previously-bypassable vector. If any of these
 * fail, the sanitizer has regressed to a bypassable state — treat as P0.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasSuspiciousContent, sanitizeText, sanitizeWPContent } from '@/lib/sanitize';

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceConsoleError() {
  vi.spyOn(console, 'error').mockImplementation(() => {});
}

describe('sanitizeWPContent() — unquoted attribute bypasses', () => {
  it('strips unquoted event handlers', () => {
    expect(sanitizeWPContent('<p onclick=alert(1)>hi</p>')).toBe('<p>hi</p>');
    expect(sanitizeWPContent('<p onmouseover=`alert(1)`>hi</p>')).toBe('<p>hi</p>');
  });

  it('neutralizes unquoted script-scheme URLs', () => {
    const out = sanitizeWPContent('<a href=javascript:alert(1)>click</a>');
    expect(out.toLowerCase()).not.toContain('javascript:');
    expect(out).toContain('href="#"');
  });

  it('neutralizes entity-encoded script URLs and backslash-prefixed external paths', () => {
    const encoded = sanitizeWPContent('<a href="java&#x73;cript:alert(1)">click</a>');
    expect(encoded.toLowerCase()).not.toContain('javascript:');

    expect(sanitizeWPContent('<a href="/\\evil.example">click</a>')).toBe('');
  });

  it('normalizes named, decimal, and malformed URL entities', () => {
    expect(sanitizeWPContent('<a href="java&colon;script:alert(1)">named</a>')).toBe(
      '<a>named</a>'
    );
    expect(sanitizeWPContent('<a href="java&#115;cript:alert(1)">decimal</a>')).toBe('');
    expect(sanitizeWPContent('<a href="java&#x110000;cript:alert(1)">malformed</a>')).not.toContain(
      'href='
    );
  });

  it('strips unquoted style attributes', () => {
    expect(sanitizeWPContent('<p style=position:fixed>hi</p>')).toBe('<p>hi</p>');
    expect(sanitizeWPContent('<div style="position:fixed;inset:0">x</div>')).toBe('<div>x</div>');
  });
});

describe('sanitizeWPContent() — protocol-relative links', () => {
  it('drops untrusted protocol-relative links', () => {
    expect(sanitizeWPContent('<a href=//evil.com>x</a>')).toBe('');
    expect(sanitizeWPContent('<a href="//evil.com/x">y</a>')).toBe('');
  });

  it('keeps trusted protocol-relative links', () => {
    const out = sanitizeWPContent('<a href="//seacleaners.org.nz/good">ok</a>');
    expect(out).toContain('seacleaners.org.nz/good');
  });
});

describe('sanitizeWPContent() — trust decisions', () => {
  it('keeps relative, anchor, mailto, and tel links', () => {
    expect(sanitizeWPContent('<a href="/contact">a</a>')).toContain('/contact');
    expect(sanitizeWPContent('<a href="#top">a</a>')).toContain('#top');
    expect(sanitizeWPContent('<a href="mailto:a@b.com">a</a>')).toContain('mailto:');
    expect(sanitizeWPContent('<a href="tel:+64000000">a</a>')).toContain('tel:');
  });

  it('keeps links without an href attribute', () => {
    expect(sanitizeWPContent('<a name="anchor">text</a>')).toContain('text');
  });

  it('drops empty hrefs', () => {
    expect(sanitizeWPContent('<a href="">x</a>')).toBe('');
  });

  it('keeps trusted subdomains', () => {
    const out = sanitizeWPContent('<a href="https://files.supabase.co/x">ok</a>');
    expect(out).toContain('files.supabase.co/x');
  });

  it('adds safe rel attributes to new-window links', () => {
    const out = sanitizeWPContent('<a href="https://stripe.com/x" target="_blank">open</a>');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('drops bare file: scheme links', () => {
    expect(sanitizeWPContent('<a href="file:///etc/passwd">x</a>')).toBe('');
  });

  it('drops unknown scheme links without host syntax', () => {
    expect(sanitizeWPContent('<a href="custom:thing">x</a>')).toBe('<a>x</a>');
  });
});

describe('sanitizeWPContent() — active content and style vectors', () => {
  it('strips svg elements including unquoted handlers', () => {
    const out = sanitizeWPContent('<svg onload=alert(1)>');
    expect(out).not.toContain('<svg');
    expect(out.toLowerCase()).not.toContain('onload');
  });

  it('strips style element bodies', () => {
    const out = sanitizeWPContent('<style>body{display:none}</style><p>keep</p>');
    expect(out).toContain('keep');
    expect(out).not.toContain('<style');
  });

  it('strips nested media source handlers', () => {
    const out = sanitizeWPContent('<video><source src=x onerror=alert(1)>></video>');
    expect(out.toLowerCase()).not.toContain('onerror');
  });
});

describe('sanitizeWPContent() — nested-markup spam', () => {
  it('removes spam paragraphs with markup before the keyword', () => {
    expect(sanitizeWPContent('<p>Buy <b>casino</b> now</p>')).toBe('');
    expect(sanitizeWPContent('<div><span>best slots</span></div><p>clean</p>')).toContain('clean');
  });
});

describe('sanitizers — fail-safe contracts', () => {
  it('sanitizeWPContent returns empty string instead of throwing', () => {
    silenceConsoleError();
    expect(sanitizeWPContent({} as unknown as string)).toBe('');
  });

  it('sanitizeText returns empty string instead of throwing', () => {
    silenceConsoleError();
    expect(sanitizeText({} as unknown as string)).toBe('');
  });

  it('hasSuspiciousContent returns false instead of throwing', () => {
    expect(hasSuspiciousContent({} as unknown as string)).toBe(false);
  });
});
