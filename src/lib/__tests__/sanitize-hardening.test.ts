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

/**
 * Container tags whose *contents* are not page copy.
 *
 * `disallowedTagsMode: 'discard'` strips a tag and keeps its children. For inline
 * markup that is right; for a container it re-injects the container's contents as
 * live markup. The Google Sites migration arrived wrapped in exactly those
 * containers, so this list is the difference between a page's furniture being
 * dropped and being rendered in the middle of its copy — and, because
 * `htmlToExcerpt` runs the same sanitizer, between that appearing in the SERP
 * meta description too.
 *
 * ## Why these needed a pre-pass rather than an option
 *
 * The obvious fixes both do nothing, and both were tried:
 *
 *   - `nonTextTags` sets sanitize-html's `skipText`, which suppresses the *raw
 *     text* directly inside a disallowed tag. A container's children are
 *     elements, so `<marquee><p>x</p></marquee>` still emitted the `<p>`.
 *   - `exclusiveFilter` is never consulted for a tag that is already disallowed:
 *     sanitize-html returns from its close handler before reaching it.
 *
 * And the pass that *does* work has an ordering constraint that is invisible
 * until it bites. Step 0.5 strips the opening and closing tags of `form`,
 * `object`, `select` and `marquee`, which destroys the evidence — after it runs
 * there is no `<marquee>` left to match, so a subtree removal placed *after* it
 * silently matches nothing and the test still fails for the original reason.
 * The removal therefore has to happen while the tags are still intact.
 */
describe('container tags drop their whole subtree, not just their tag', () => {
  const CASES: Array<{ tag: string; body: string; leaked: string }> = [
    { tag: 'template', body: '<p>Search this site</p>', leaked: 'Search this site' },
    { tag: 'noscript', body: '<p>Skip to main content</p>', leaked: 'Skip to main content' },
    {
      tag: 'details',
      body: '<summary>Page details</summary><p>Page updated</p>',
      leaked: 'Page updated',
    },
    { tag: 'marquee', body: '<p>Report abuse</p>', leaked: 'Report abuse' },
    { tag: 'listing', body: '<p>Embedded Files</p>', leaked: 'Embedded Files' },
    { tag: 'form', body: '<p>Page details</p>', leaked: 'Page details' },
    { tag: 'xmp', body: '<p>Embedded Files</p>', leaked: 'Embedded Files' },
    { tag: 'object', body: '<p>Embedded Files</p>', leaked: 'Embedded Files' },
    { tag: 'select', body: '<option>Embedded Files</option>', leaked: 'Embedded Files' },
  ];

  for (const { tag, body, leaked } of CASES) {
    it(`drops the children of <${tag}>`, () => {
      const out = sanitizeWPContent(`<${tag}>${body}</${tag}>`);
      expect(out).not.toContain(leaked);
    });
  }

  it('keeps the four the migration is known to have truncated', () => {
    for (const [tag, body] of [
      ['nav', '<p>Home About Contact</p>'],
      ['aside', '<p>Related links</p>'],
      ['header', '<p>Site header</p>'],
      ['footer', '<p>Site footer</p>'],
    ] as const) {
      expect(sanitizeWPContent(`<${tag}>${body}</${tag}>`)).not.toContain(body);
    }
  });

  it('does not let a form contribute its button label as body copy', () => {
    // The real shape of the harm, and it is worth stating precisely because the
    // stronger claim is false. A `<form>` does NOT leave a working control
    // behind — `input` is not in `allowedTags` and is always stripped. What it
    // leaves is its children's *text* rendered as page copy, so a migrated
    // search box contributes a bare "Go" in the middle of a sentence.
    const out = sanitizeWPContent('<form action="/search"><button>Go</button></form>');
    expect(out).not.toContain('Go');
    // And the input was never a risk in the first place, which is why this
    // assertion is here rather than assumed.
    expect(sanitizeWPContent('<form><input name="q"></form>')).not.toMatch(/<input/i);
  });

  it('leaves the rest of a document alone when a container is unclosed', () => {
    // The unclosed sweep runs to the end of the input, so it is applied only to
    // the four the migration actually truncated. Applying it to `<form>` would
    // delete the rest of an otherwise valid page.
    expect(sanitizeWPContent('<p>Real copy.</p><form><p>chrome</p>')).toContain('Real copy.');
  });

  it('still keeps real authored copy', () => {
    // A length-only guard would satisfy every test above by sanitizing nothing.
    const out = sanitizeWPContent(
      '<p>March agenda</p><h2>Budget</h2><ul><li>Motion</li></ul><a href="/contact">Contact</a>'
    );
    expect(out).toContain('March agenda');
    expect(out).toContain('Budget');
    expect(out).toContain('Motion');
    expect(out).toContain('href="/contact"');
  });
});
