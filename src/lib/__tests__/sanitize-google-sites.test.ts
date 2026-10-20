// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { htmlToExcerpt, sanitizeWPContent, stripMigratedSiteChrome } from '@/lib/sanitize';

// The CMS was migrated from a Google Site whose entire navigation was baked into
// every page body. Left in place it repeated "Search this site" and
// "Skip to main content" several times per page *and* became the meta
// description, because descriptions were derived from the first 150 characters
// of the raw body. Shipped snippets began:
//
//   "IndivisibleFairOaks.org - Links Search this site Embedded Files Skip to main content…"
//
// These tests pin the stripping behaviour and the excerpt extraction that fixed it.

const GOOGLE_SITES_CHROME = `
  <div class="gs-header">
    <a href="/">IndivisibleFairOaks.org</a>
    <a href="/search">Search this site</a>
  </div>
  <nav class="globalnav">
    <ul>
      <li><a href="/about">About</a></li>
      <li><a href="/events">Events</a></li>
      <li><a href="/voter-info">Voter Info</a></li>
    </ul>
  </nav>
`;

describe('sanitizeWPContent — Google Sites page furniture', () => {
  it('drops the navigation element and everything inside it', () => {
    const out = sanitizeWPContent(`<nav>${GOOGLE_SITES_CHROME}</nav><p>Real content.</p>`);
    expect(out).toContain('Real content.');
    expect(out).not.toContain('Search this site');
  });

  it('drops sidebar and header/footer containers wholesale', () => {
    const html = [
      '<header>Site header junk</header>',
      '<aside>Sidebar junk</aside>',
      '<footer>Footer junk</footer>',
      '<p>Real content.</p>',
    ].join('');
    const out = sanitizeWPContent(html);
    expect(out).toContain('Real content.');
    for (const junk of ['Site header junk', 'Sidebar junk', 'Footer junk']) {
      expect(out).not.toContain(junk);
    }
  });

  it('drops a Google Sites wrapper div identified by its class', () => {
    const html = '<div class="gs-search">Search this site</div><p>Real content.</p>';
    const out = sanitizeWPContent(html);
    expect(out).not.toContain('Search this site');
    expect(out).toContain('Real content.');
  });

  it('removes boilerplate phrases that survive as bare text', () => {
    const out = sanitizeWPContent(
      '<p>Search this site Skip to main content Embedded Files Actual copy.</p>'
    );
    expect(out).toContain('Actual copy.');
    expect(out).not.toContain('Search this site');
    expect(out).not.toContain('Skip to main content');
    expect(out).not.toContain('Embedded Files');
  });

  it('preserves real editorial content that follows the chrome', () => {
    const html = `${GOOGLE_SITES_CHROME}<h2>Meeting notes</h2><p>We gathered at the church.</p>`;
    const out = sanitizeWPContent(html);
    expect(out).toContain('Meeting notes');
    expect(out).toContain('We gathered at the church.');
  });

  it('still strips scripts and iframes from migrated content', () => {
    const out = sanitizeWPContent(
      '<p>Hi</p><script>alert(1)</script><iframe src="https://evil.test"></iframe>'
    );
    expect(out).not.toContain('alert(1)');
    expect(out).not.toContain('iframe');
    expect(out).toContain('Hi');
  });

  it('returns an empty string for empty input', () => {
    expect(sanitizeWPContent('')).toBe('');
  });
});

describe('htmlToExcerpt', () => {
  it('never leaks navigation chrome into the description', () => {
    const html = `${GOOGLE_SITES_CHROME}<p>Our chapter defends democracy in Carmichael.</p>`;
    const excerpt = htmlToExcerpt(html);
    expect(excerpt).toContain('Our chapter defends democracy in Carmichael.');
    expect(excerpt).not.toContain('Search this site');
    expect(excerpt).not.toContain('Skip to');
  });

  it('strips tags and collapses whitespace', () => {
    expect(htmlToExcerpt('<p>One</p><p>Two</p>')).toBe('One Two');
  });

  it('decodes the entities a CMS body is full of', () => {
    expect(htmlToExcerpt('<p>Tom &amp; Jerry &lt;3 &quot;quotes&quot;</p>')).toBe(
      'Tom & Jerry <3 "quotes"'
    );
  });

  it('truncates long content and appends an ellipsis', () => {
    const excerpt = htmlToExcerpt(`<p>${'word '.repeat(80)}</p>`, 100);
    expect(excerpt.length).toBeLessThanOrEqual(101);
    expect(excerpt.endsWith('…')).toBe(true);
  });

  it('returns an empty string when there is no content', () => {
    expect(htmlToExcerpt('')).toBe('');
    expect(htmlToExcerpt('<nav>only chrome</nav>')).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The Google Sites export is plain TEXT, not HTML — every tag was stripped, so
// the site chrome is a run of literal lines. Verified against the live `content`
// table: bodies begin "IndivisibleFairOaks.org - <Title>" then "Search this site",
// "Embedded Files", "Skip to main content", "Skip to navigation", then the same
// sidebar navigation three or four times, and end "Report abuse / Page details /
// Page updated".
// ─────────────────────────────────────────────────────────────────────────────

const NAV_LABELS = [
  'Home',
  'Voter Information',
  'Upcoming Events',
  'Weekend of  Protest Song',
  'Good Trouble',
  'Upcoming Fall Events',
  'Current Events',
  'Links',
  'Resistance Choir',
  'Newsletters',
];

function exportBody(title: string, content: string[]): string {
  return [
    `IndivisibleFairOaks.org - ${title}`,
    'Search this site',
    'Embedded Files',
    'Skip to main content',
    'Skip to navigation',
    ...NAV_LABELS,
    ...NAV_LABELS,
    ...NAV_LABELS,
    title,
    ...content,
    'Get in touch with our chapter at',
    'contact@indivisiblefairoaks.org',
    'Report abuse',
    'Page details',
    'Last edited by Christiana on 2026-09-02.',
    'Page updated',
    'Report abuse',
  ].join('\n');
}

describe('stripMigratedSiteChrome', () => {
  it('removes the export banner and search affordances', () => {
    const out = stripMigratedSiteChrome(exportBody('Good Trouble', ['Banner drop copy.']));
    expect(out).not.toContain('Search this site');
    expect(out).not.toContain('Embedded Files');
    expect(out).not.toContain('Skip to main content');
    expect(out).not.toContain('Skip to navigation');
  });

  it('collapses the triplicated navigation to nothing', () => {
    const out = stripMigratedSiteChrome(exportBody('Good Trouble', ['Banner drop copy.']));
    for (const label of NAV_LABELS) {
      const occurrences = out.split(label).length - 1;
      expect(occurrences).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the real heading, which duplicates a nav label', () => {
    const out = stripMigratedSiteChrome(exportBody('Good Trouble', ['Banner drop copy.']));
    expect(out.split('\n')[0]).toBe('Good Trouble');
  });

  it('removes the trailing Google Sites footer block', () => {
    const out = stripMigratedSiteChrome(exportBody('Good Trouble', ['Banner drop copy.']));
    expect(out).not.toContain('Report abuse');
    expect(out).not.toContain('Page details');
    expect(out).not.toContain('Page updated');
    expect(out).not.toMatch(/Last edited by/);
  });

  it('preserves the actual body copy', () => {
    const out = stripMigratedSiteChrome(
      exportBody('Resistance Choir', ['Every good protest movement needs music.'])
    );
    expect(out).toContain('Every good protest movement needs music.');
  });

  it('leaves hand-authored content completely untouched', () => {
    const authored = 'We meet on the first Tuesday.\nHome\nVoter Information\nReport your RSVP.';
    // No Google Sites markers, so the export cleanup must not engage at all.
    expect(stripMigratedSiteChrome(authored)).toBe(authored);
  });

  it('does not collapse ordinary prose that repeats a phrase', () => {
    const authored = [
      'Search this site is a feature we love.',
      'Embedded Files are attached below.',
      'Skip to main content is a link.',
      'Act now. Act now. Act now. Act now.',
    ].join('\n');
    // Markers present, but there is no repeated *block* of lines, so nothing to
    // collapse and the text survives.
    expect(stripMigratedSiteChrome(authored)).toContain('Act now. Act now. Act now. Act now.');
  });

  it('returns an empty string for empty input', () => {
    expect(stripMigratedSiteChrome('')).toBe('');
  });
});

describe('sanitizeWPContent on exported plain text', () => {
  it('produces an excerpt of real copy with no navigation in it', () => {
    const excerpt = htmlToExcerpt(exportBody('Voter Information', ['Pre-register at 16.']));
    expect(excerpt).toContain('Pre-register at 16.');
    expect(excerpt).not.toContain('Search this site');
    expect(excerpt).not.toContain('Skip to main content');
    // "Voter Information" appears once, as the page's own heading.
    expect(excerpt.split('Voter Information').length - 1).toBe(1);
  });

  it('runs the export cleanup before any HTML handling', () => {
    const html = `${exportBody('Good Trouble', ['<p>Banner drop copy.</p>'])}`;
    const out = sanitizeWPContent(html);
    expect(out).toContain('Banner drop copy.');
    expect(out).not.toContain('Search this site');
  });
});
