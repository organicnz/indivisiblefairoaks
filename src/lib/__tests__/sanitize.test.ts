import { describe, expect, it } from 'vitest';
import {
  hasSuspiciousContent,
  isSpamContent,
  sanitizeText,
  sanitizeWPContent,
} from '@/lib/sanitize';

describe('sanitizeWPContent() — XSS vectors', () => {
  it('strips <script> tags entirely', () => {
    const out = sanitizeWPContent('<p>Fine</p><script>alert(1)</script>');
    expect(out).toBe('<p>Fine</p>');
    expect(out.toLowerCase()).not.toContain('script');
    expect(out.toLowerCase()).not.toContain('alert');
  });

  it('strips script with attributes and multiline bodies', () => {
    const out = sanitizeWPContent(
      '<p>a</p><script type="text/javascript">\nvar x = "<p>decoy</p>";\n</script><p>b</p>'
    );
    expect(out).toContain('<p>a</p>');
    expect(out).toContain('<p>b</p>');
    expect(out.toLowerCase()).not.toContain('script');
  });

  it('removes iframe/object/embed/form/input elements', () => {
    const out = sanitizeWPContent(
      '<iframe src="https://evil.example"></iframe><object data="x"></object>' +
        '<form action="https://evil.example"><input type="text"><button>Go</button></form><p>keep</p>'
    );
    // Tag bodies are gone; only inert stray text may remain.
    expect(out).not.toContain('<form');
    expect(out).not.toContain('<input');
    expect(out).not.toContain('<button');
    expect(out).toContain('keep');
  });

  it('neutralizes javascript: and data: hrefs', () => {
    const out = sanitizeWPContent(
      '<a href="javascript:alert(1)">click</a><a href=\'DATA:text/html,<b>x</b>\'>y</a>'
    );
    expect(out.toLowerCase()).not.toContain('javascript:');
    expect(out.toLowerCase()).not.toContain('data:');
    expect(out).toContain('href="#"');
  });

  it('strips inline event handlers (existing behaviour, locked)', () => {
    const out = sanitizeWPContent('<p onclick="alert(1)" onmouseover="x()">hi</p>');
    expect(out).toBe('<p>hi</p>');
  });
});

describe('sanitizeWPContent() — legacy WordPress artifacts', () => {
  it('removes Gutenberg comments', () => {
    const out = sanitizeWPContent('<!-- wp:paragraph --><p>Hi</p><!-- /wp:paragraph -->');
    expect(out).toBe('<p>Hi</p>');
  });

  it('replaces wpforms shortcodes with the contact CTA', () => {
    const out = sanitizeWPContent('[wpforms id="1"]');
    expect(out).toContain('/contact');
    expect(out).toContain('Contact Page');
  });

  it('drops untrusted external links but keeps trusted ones', () => {
    const out = sanitizeWPContent(
      '<a href="https://spam.example/x">bad</a><a href="https://seacleaners.org.nz/good">good</a>'
    );
    expect(out).not.toContain('spam.example');
    expect(out).toContain('seacleaners.org.nz/good');
  });

  it('removes spam-keyword paragraphs wholesale', () => {
    const out = sanitizeWPContent('<p>Buy casino chips now</p><p>Clean text stays</p>');
    expect(out).not.toContain('casino');
    expect(out).toContain('Clean text stays');
  });

  it('removes blocks of 3+ consecutive links', () => {
    const out = sanitizeWPContent(
      '<a href="/a">1</a><a href="/b">2</a><a href="/c">3</a><p>kept</p>'
    );
    expect(out).toContain('kept');
    expect(out).not.toContain('<a');
  });

  // The spam-keyword match used to use a plain `[\s\S]*?` between the opening tag
  // and the keyword, which happily spanned sibling blocks. A keyword inside a
  // later blockquote let the *earlier* <p> swallow everything up to the next
  // </p>, so an innocent quote was destroyed along with the spam. Found by
  // property-testing the block editor's round trip.
  it('does not let a spam keyword in one block delete a sibling block', () => {
    const out = sanitizeWPContent(
      '<p>An innocent opening paragraph.</p>' +
        '<blockquote class="cw-quote"><p>Our quote mentions a casino once.</p></blockquote>' +
        '<p>A closing paragraph that must survive.</p>'
    );
    expect(out).toContain('An innocent opening paragraph.');
    expect(out).toContain('A closing paragraph that must survive.');
    // The containing element is still removed — the match just no longer escapes it.
    expect(out).not.toContain('Our quote mentions a casino once.');
  });

  it('still removes the element that actually contains a spam keyword', () => {
    const out = sanitizeWPContent(
      '<p>Legit intro.</p><p>Cheap casino chips here</p><p>Legit outro.</p>'
    );
    expect(out).toContain('Legit intro.');
    expect(out).toContain('Legit outro.');
    expect(out).not.toContain('casino');
  });

  it('does not let a spam keyword in a div delete a following sibling', () => {
    const out = sanitizeWPContent(
      '<div>Clean block</div><div>Slot machine deal</div><p>Tail stays</p>'
    );
    expect(out).toContain('Clean block');
    expect(out).toContain('Tail stays');
    expect(out).not.toContain('Slot machine');
  });
});

describe('isSpamContent()', () => {
  it('flags known spam keywords case-insensitively', () => {
    expect(isSpamContent('Best CASINO online')).toBe(true);
    expect(isSpamContent('hot slots action')).toBe(true); // 'slots' contains keyword 'slot'
    expect(isSpamContent('situs gacor')).toBe(true);
    expect(isSpamContent('premium fishing braid')).toBe(false);
  });

  it('flags non-ASCII injection but tolerates brand name', () => {
    expect(isSpamContent('лото клуб bonus')).toBe(true);
    expect(isSpamContent('indivisible quality braid')).toBe(false);
  });
});

describe('sanitizeText()', () => {
  it('redacts spam keywords with ellipsis in plain text', () => {
    expect(sanitizeText('cheap casino deals')).toMatchInlineSnapshot(`"cheap ... deals"`);
  });

  it('returns empty string for empty input and never throws on weird input', () => {
    expect(sanitizeText('')).toBe('');
    // @ts-expect-error — runtime fail-safe contract
    expect(sanitizeText(null)).toBe('');
  });
});

describe('hasSuspiciousContent()', () => {
  it('flags >5 links, base64 payloads, and URL-encoded obfuscation', () => {
    const manyLinks = Array.from({ length: 6 }, (_, i) => `<a href="/l${i}">x</a>`).join('');
    expect(hasSuspiciousContent(manyLinks)).toBe(true);
    expect(hasSuspiciousContent('<img src="data:image/png;base64,AAAA">')).toBe(true);
    expect(hasSuspiciousContent('click %20 here %41 now %42')).toBe(true);
    expect(hasSuspiciousContent('<p>totally fine content</p>')).toBe(false);
  });
});
