// @vitest-environment jsdom
import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyBlockShell,
  type Block,
  blockText,
  CALLOUT_TONES,
  cloneBlockWithFreshIds,
  createRowBlock,
  designClassesOf,
  isBlockEmpty,
  isTextualBlock,
  isTransient,
  parseHtml,
  readBlockShell,
  resetBlockIds,
  serializeBlocks,
  stripTags,
  structuralClassesForBlock,
  structuralClassesOf,
  themeAttributesFor,
  themeClassTokens,
  themeModeFromClassList,
} from '@/lib/blocks';
import { containsSpamKeyword, sanitizeWPContent } from '@/lib/sanitize';

/** Block identity is session-scoped and irrelevant to round-trip equality. */
function withoutIds(blocks: Block[]) {
  return blocks.map(({ id: _id, ...rest }) => rest);
}

function fixture(block: Block): string {
  return serializeBlocks([block]);
}

/**
 * Generated text occasionally lands on a spam keyword — a random three-letter
 * button label like "RTp" is a real collision, and it was the cause of a
 * property failing roughly one full-suite run in eight.
 *
 * The sanitizer deleting that is *correct*: "rtp" is a keyword precisely because
 * casino spam is full of it, and a page whose body says "casino" is a page the
 * spam filter is built to strip. So these two properties are about structural
 * fidelity — that the serializer's own markup survives its own round trip — and
 * a document that is actually spam is outside their claim, not a counterexample
 * to it. Silencing the filter instead would leave the genuine deletion untested.
 */
const mentionsSpamKeyword = (blocks: Block[]): boolean =>
  containsSpamKeyword(serializeBlocks(blocks).replace(/<[^>]*>/g, ' '));

describe('block serialization is sanitizer-safe', () => {
  beforeEach(() => resetBlockIds());

  const cases: Array<[string, Block]> = [
    [
      'paragraph',
      { id: 'x', type: 'paragraph', html: 'Join us <strong>Saturday</strong> at noon.' },
    ],
    ['heading', { id: 'x', type: 'heading', level: 2, html: 'What to bring' }],
    ['bullet list', { id: 'x', type: 'bulletList', items: ['Water', 'Sun hat', '<em>Id</em>'] }],
    ['ordered list', { id: 'x', type: 'orderedList', items: ['Register', 'Vote', 'Recruit'] }],
    ['quote', { id: 'x', type: 'quote', html: 'Democracy is not a gift. It is a practice.' }],
    ['callout info', { id: 'x', type: 'callout', tone: 'info', html: 'Doors open at 9am.' }],
    ['callout action', { id: 'x', type: 'callout', tone: 'action', html: 'Bring ten neighbors.' }],
    [
      'callout warning',
      { id: 'x', type: 'callout', tone: 'warning', html: 'Cancelled if it rains.' },
    ],
    ['code', { id: 'x', type: 'code', text: 'const x = a < b && c > d;' }],
    [
      'image with caption',
      {
        id: 'x',
        type: 'image',
        src: 'https://example.org/photo.jpg',
        alt: 'Carmichael Park rally',
        caption: 'Spring rally, 2026',
        width: 1200,
        height: 800,
      },
    ],
    ['divider', { id: 'x', type: 'divider' }],
    ['table', { id: 'x', type: 'table', head: ['Office', 'Phone'], rows: [['Bera', '555-0100']] }],
    ['button', { id: 'x', type: 'button', label: 'RSVP here', href: '/events' }],
  ];

  it.each(cases)('%s survives sanitizeWPContent unchanged', (_name, block) => {
    const html = fixture(block);
    expect(sanitizeWPContent(html)).toBe(html);
  });

  it.each(cases)('%s round-trips through parse → serialize', (_name, block) => {
    expect(withoutIds(parseHtml(fixture(block)))).toEqual([withoutIds([block])[0]]);
  });
});

describe('round trip through the real render pipeline', () => {
  beforeEach(() => resetBlockIds());

  it('is idempotent for a full document', () => {
    const blocks: Block[] = [
      { id: '1', type: 'heading', level: 2, html: 'Meeting agenda' },
      { id: '2', type: 'paragraph', html: 'We will <strong>vote</strong> on three items.' },
      { id: '3', type: 'bulletList', items: ['Treasurer report', 'Bera runoff', 'Phone bank'] },
      { id: '4', type: 'callout', tone: 'action', html: 'Bring a neighbor.' },
      {
        id: '5',
        type: 'image',
        src: 'https://example.org/a.jpg',
        alt: 'Alt',
        caption: 'Cap',
        width: 800,
        height: 600,
      },
      { id: '6', type: 'quote', html: 'We show up.' },
      { id: '7', type: 'table', head: ['A', 'B'], rows: [['1', '2']] },
      { id: '8', type: 'divider' },
      { id: '9', type: 'button', label: 'Volunteer', href: '/volunteer' },
      { id: '10', type: 'code', text: 'x < y' },
    ];
    const once = serializeBlocks(blocks);
    const twice = serializeBlocks(parseHtml(once));
    expect(twice).toBe(once);
  });

  /**
   * An image's measured dimensions must reach the reader, and the only route to
   * that is the sanitizer agreeing to keep the attributes.
   *
   * `width` / `height` are what make the browser reserve the image's box before
   * the bytes arrive. They were present in the model and the serializer from the
   * start and populated by nothing, so every content image shifted layout as it
   * loaded — and the moment an uploader started filling them in, the allowlist
   * (`img: src, alt, width, height, loading`) became load-bearing. If it ever
   * narrows, this fails at the boundary rather than as a slow, invisible
   * regression in the field.
   */
  it("carries an image's dimensions through sanitize and back", () => {
    const blocks: Block[] = [
      {
        id: '1',
        type: 'image',
        src: 'https://example.org/rally.jpg',
        alt: 'Volunteers at the town hall',
        caption: '',
        width: 1400,
        height: 933,
      },
    ];
    const saved = serializeBlocks(blocks);

    expect(saved).toContain('width="1400"');
    expect(saved).toContain('height="933"');
    // The attribute has to survive the sanitizer, not merely the serializer.
    expect(sanitizeWPContent(saved)).toContain('width="1400"');
    // And it has to be readable again, or a second save would silently drop it
    // and the next publish would shift again.
    expect(withoutIds(parseHtml(sanitizeWPContent(saved)))).toEqual(withoutIds(blocks));
  });

  it('omits the attributes entirely for an unmeasured image', () => {
    // A hand-typed URL has no measurement. Emitting `width=""` or a zero would
    // reserve nothing or render nothing, so the attributes are left off.
    const saved = serializeBlocks([
      {
        id: '1',
        type: 'image',
        src: 'https://example.org/a.jpg',
        alt: '',
        caption: '',
        width: null,
        height: null,
      },
    ]);
    expect(saved).not.toContain('width=');
    expect(saved).not.toContain('height=');
    expect(sanitizeWPContent(saved)).toBe(saved);
  });

  it('preserves blocks after sanitization, not just before it', () => {
    // The real pipeline sanitizes at render, so the block count an author sees
    // must match the block count that was saved.
    const blocks: Block[] = [
      { id: '1', type: 'paragraph', html: 'First paragraph.' },
      { id: '2', type: 'callout', tone: 'warning', html: 'Rain expected.' },
      { id: '3', type: 'divider' },
      { id: '4', type: 'button', label: 'Details', href: '/events' },
    ];
    const saved = serializeBlocks(blocks);
    const rendered = sanitizeWPContent(saved);
    expect(withoutIds(parseHtml(rendered))).toEqual(withoutIds(blocks));
  });
});

describe('adjacent button blocks are not deleted as link spam', () => {
  it('survives three consecutive buttons', () => {
    // sanitizeWPContent step 5 removes runs of 3+ directly adjacent anchors,
    // which is why button blocks carry a wrapper element.
    const html = serializeBlocks([
      { id: '1', type: 'button', label: 'RSVP', href: '/a' },
      { id: '2', type: 'button', label: 'Volunteer', href: '/b' },
      { id: '3', type: 'button', label: 'Donate', href: '/c' },
    ]);
    expect(sanitizeWPContent(html)).toBe(html);
    expect(withoutIds(parseHtml(sanitizeWPContent(html)))).toEqual(
      withoutIds([
        { id: '1', type: 'button', label: 'RSVP', href: '/a' },
        { id: '2', type: 'button', label: 'Volunteer', href: '/b' },
        { id: '3', type: 'button', label: 'Donate', href: '/c' },
      ])
    );
  });
});

describe('legacy and unknown content is never destroyed', () => {
  beforeEach(() => resetBlockIds());

  it('preserves a definition list verbatim as an unsupported block', () => {
    const html = '<dl><dt>Term</dt><dd>Definition</dd></dl>';
    const blocks = parseHtml(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('unsupported');
    expect(serializeBlocks(blocks)).toBe(html);
  });

  it('unwraps a div that only wraps a single block', () => {
    const blocks = parseHtml('<div><p>Only child</p></div>');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'paragraph', html: 'Only child' });
  });

  it('turns bare text from a text-only migration into a paragraph', () => {
    const blocks = parseHtml('Skip to main content\n\nSome real copy here.');
    expect(
      blocks.some((b) => b.type === 'paragraph' && stripTags(b.html).includes('real copy'))
    ).toBe(true);
  });

  it('treats an unwrapped <ul> as a list', () => {
    const blocks = parseHtml('<ul><li>One</li><li>Two</li></ul>');
    expect(blocks[0]).toMatchObject({ type: 'bulletList', items: ['One', 'Two'] });
  });

  it('adopts the tag level for a legacy heading with no class', () => {
    expect(parseHtml('<h3>Legacy</h3>')[0]).toMatchObject({ type: 'heading', level: 3 });
  });

  it('lets an explicit class override the tag level', () => {
    expect(parseHtml('<h2 class="cw cw--h4">Demoted</h2>')[0]).toMatchObject({ level: 4 });
  });
});

describe('empty blocks', () => {
  beforeEach(() => resetBlockIds());

  it('drops an empty paragraph instead of persisting markup the sanitizer deletes', () => {
    const html = serializeBlocks([
      { id: '1', type: 'paragraph', html: 'Real content.' },
      { id: '2', type: 'paragraph', html: '' },
    ]);
    expect(html).toBe('<p>Real content.</p>');
  });

  it('emits a single empty paragraph for an empty document', () => {
    expect(serializeBlocks([])).toBe('<p></p>');
    expect(serializeBlocks([{ id: '1', type: 'paragraph', html: '   ' }])).toBe('<p></p>');
  });

  it('does not re-wrap inline content that is already a block element', () => {
    // `maybeWrapInline` only adds a <p> when the content is not already
    // block-level, so a callout holding a list must not gain a paragraph wrapper
    // on every save.
    const nested: Block = {
      id: '1',
      type: 'callout',
      tone: 'info',
      html: '<ul><li>One</li></ul>',
    };
    const saved = serializeBlocks([nested]);
    expect(saved).toBe('<div class="cw-callout cw-callout--info"><ul><li>One</li></ul></div>');
    expect(sanitizeWPContent(saved)).toBe(saved);
    expect(withoutIds(parseHtml(saved))).toEqual([
      { type: 'callout', tone: 'info', html: '<ul><li>One</li></ul>' },
    ]);
  });

  it('handles a table with no columns at all', () => {
    // Reachable when a row exists but is completely empty: the row keeps the
    // table from being dropped, while the column count collapses to zero.
    const empty: Block = { id: '1', type: 'table', head: [], rows: [[]] };
    const saved = serializeBlocks([empty]);
    expect(saved).toBe('<table class="cw-table"><tbody><tr></tr></tbody></table>');
    expect(sanitizeWPContent(saved)).toBe(saved);
  });

  it('reports emptiness for each block kind', () => {
    expect(isBlockEmpty({ id: '1', type: 'paragraph', html: '<br>' })).toBe(true);
    expect(isBlockEmpty({ id: '2', type: 'paragraph', html: 'x' })).toBe(false);
    expect(
      isBlockEmpty({
        id: '3',
        type: 'image',
        src: '',
        alt: '',
        caption: '',
        width: null,
        height: null,
      })
    ).toBe(true);
  });
});

it('normalises a ragged table to rectangular without dropping cells', () => {
  // A row wider than the header used to be truncated to the header width. The
  // column count now comes from the widest row, so extra cells survive and
  // short rows gain empty cells instead.
  const ragged: Block = {
    id: '1',
    type: 'table',
    head: ['Office'],
    rows: [['Bera', 'Matsui'], ['Kiley']],
  };
  const saved = serializeBlocks([ragged]);
  expect(saved).toBe(
    '<table class="cw-table"><thead><tr><th>Office</th><th></th></tr></thead>' +
      '<tbody><tr><td>Bera</td><td>Matsui</td></tr><tr><td>Kiley</td><td></td></tr></tbody></table>'
  );
  expect(withoutIds(parseHtml(saved))).toEqual([
    {
      type: 'table',
      head: ['Office', ''],
      rows: [
        ['Bera', 'Matsui'],
        ['Kiley', ''],
      ],
    },
  ]);
});

it('keeps a row wider than its header', () => {
  const saved = serializeBlocks([
    { id: '1', type: 'table', head: ['When'], rows: [['Sat', '9am', 'Carmichael Park']] },
  ]);
  expect(sanitizeWPContent(saved)).toBe(saved);
  expect(saved).toContain('<td>9am</td><td>Carmichael Park</td>');
});

it('does not emit a non-breaking space entity for empty cells', () => {
  // sanitize-html decodes and re-encodes entities, so a literal `&nbsp;` would
  // never survive byte-for-byte and every save would rewrite the document.
  const saved = serializeBlocks([{ id: '1', type: 'table', head: ['A'], rows: [['']] }]);
  expect(saved).not.toContain('&nbsp;');
});

describe('blockText', () => {
  const text = (block: Block) => blockText(block);

  it('flattens inline markup for every textual block kind', () => {
    expect(text({ id: '1', type: 'paragraph', html: 'Plain copy' })).toBe('Plain copy');
    expect(text({ id: '2', type: 'heading', level: 2, html: 'Agenda' })).toBe('Agenda');
    expect(text({ id: '3', type: 'quote', html: '<em>We show up.</em>' })).toBe('We show up.');
    expect(text({ id: '4', type: 'callout', tone: 'info', html: '<p>Doors at 9</p>' })).toBe(
      'Doors at 9'
    );
  });

  it('joins list items', () => {
    expect(text({ id: '5', type: 'bulletList', items: ['One', '<b>Two</b>'] })).toBe('One Two');
    expect(text({ id: '6', type: 'orderedList', items: ['A', 'B'] })).toBe('A B');
  });

  it('reads non-textual blocks', () => {
    expect(text({ id: '7', type: 'code', text: 'x < y' })).toBe('x < y');
    expect(
      text({
        id: '8',
        type: 'image',
        src: '/a.jpg',
        alt: 'Alt text',
        caption: 'Caption',
        width: null,
        height: null,
      })
    ).toBe('Alt text Caption');
    expect(
      text({
        id: '9',
        type: 'image',
        src: '/a.jpg',
        alt: '',
        caption: '',
        width: null,
        height: null,
      })
    ).toBe('');
    expect(text({ id: '10', type: 'table', head: ['A'], rows: [['1', '2']] })).toBe('A 1 2');
    expect(text({ id: '11', type: 'button', label: 'RSVP', href: '/a' })).toBe('RSVP');
    expect(text({ id: '12', type: 'divider' })).toBe('');
    expect(text({ id: '13', type: 'unsupported', html: '<dl><dt>Term</dt></dl>' })).toBe('Term');
  });
});

describe('isTextualBlock and isTransient', () => {
  it('identifies blocks whose content is inline HTML', () => {
    expect(isTextualBlock({ id: '1', type: 'paragraph', html: '' })).toBe(true);
    expect(isTextualBlock({ id: '2', type: 'heading', level: 2, html: '' })).toBe(true);
    expect(isTextualBlock({ id: '3', type: 'quote', html: '' })).toBe(true);
    expect(isTextualBlock({ id: '4', type: 'callout', tone: 'info', html: '' })).toBe(true);
    expect(isTextualBlock({ id: '5', type: 'divider' })).toBe(false);
    expect(
      isTextualBlock({
        id: '6',
        type: 'image',
        src: '',
        alt: '',
        caption: '',
        width: null,
        height: null,
      })
    ).toBe(false);
  });

  it('treats an empty paragraph as transient but an empty divider as real', () => {
    expect(isTransient({ id: '1', type: 'paragraph', html: '' })).toBe(true);
    expect(isTransient({ id: '2', type: 'paragraph', html: '<br>' })).toBe(true);
    expect(isTransient({ id: '3', type: 'paragraph', html: 'text' })).toBe(false);
    expect(isTransient({ id: '4', type: 'divider' })).toBe(false);
  });
});

describe('parser edge cases', () => {
  beforeEach(() => resetBlockIds());

  it('reads a bare top-level anchor as a button', () => {
    expect(parseHtml('<a href="/contact">Contact us</a>')[0]).toMatchObject({
      type: 'button',
      label: 'Contact us',
      href: '/contact',
    });
  });

  it('preserves a labelless anchor rather than dropping it', () => {
    // Not a button (no label to click), but still content the editor must not
    // destroy, so it round-trips verbatim as an unsupported block.
    const html = '<a href="/contact"></a>';
    const blocks = parseHtml(html);
    expect(blocks[0].type).toBe('unsupported');
    expect(serializeBlocks(blocks)).toBe(html);
  });

  it('keeps a div whose single child is not a block as unsupported', () => {
    const blocks = parseHtml('<div><span>Just a span</span></div>');
    expect(blocks[0].type).toBe('unsupported');
    expect(serializeBlocks(blocks)).toBe('<div><span>Just a span</span></div>');
  });

  it('unwraps a div wrapping a single callout', () => {
    const blocks = parseHtml(
      '<div><div class="cw-callout cw-callout--warning">Heads up</div></div>'
    );
    expect(blocks[0]).toMatchObject({ type: 'callout', tone: 'warning' });
  });

  it('keeps a figure with no image as unsupported', () => {
    const blocks = parseHtml(
      '<figure class="cw-figure"><figcaption>No image</figcaption></figure>'
    );
    expect(blocks[0].type).toBe('unsupported');
  });

  it('reads a table that has only a thead', () => {
    expect(
      parseHtml('<table><thead><tr><th>A</th><th>B</th></tr></thead></table>')[0]
    ).toMatchObject({ type: 'table', head: ['A', 'B'], rows: [] });
  });

  it('promotes the first body row to the header when there is no thead', () => {
    expect(
      parseHtml(
        '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>1</td><td>2</td></tr></tbody></table>'
      )[0]
    ).toMatchObject({ head: ['A', 'B'], rows: [['1', '2']] });
  });

  it('reads a pre with no <code> child', () => {
    expect(parseHtml('<pre class="cw-code">plain &amp; simple</pre>')[0]).toMatchObject({
      type: 'code',
      text: 'plain & simple',
    });
  });

  it('reads a code block without accumulating entity re-decoding', () => {
    const block = { id: '1', type: 'code', text: 'a && b < c' } as const;
    const saved = serializeBlocks([block]);
    expect(parseHtml(saved)[0]).toMatchObject({ type: 'code', text: 'a && b < c' });
  });

  it('keeps an unwrapped blockquote and callout as their own kinds', () => {
    expect(parseHtml('<blockquote>Legacy quote</blockquote>')[0]).toMatchObject({ type: 'quote' });
    expect(parseHtml('<div class="cw-callout">Legacy callout</div>')[0]).toMatchObject({
      type: 'callout',
      tone: 'info',
    });
  });

  it('falls back to info for a callout whose tone class is not recognised', () => {
    expect(parseHtml('<div class="cw-callout cw-callout--chartreuse">X</div>')[0]).toMatchObject({
      tone: 'info',
    });
  });

  it('handles a div wrapper around a heading', () => {
    expect(parseHtml('<div><h2>Wrapped</h2></div>')[0]).toMatchObject({
      type: 'heading',
      level: 2,
    });
  });

  it('produces one empty placeholder paragraph for an empty document', () => {
    // The editor always needs somewhere to put the cursor. The placeholder is
    // dropped again on save, so opening and closing a blank page creates nothing.
    const placeholder = [{ id: expect.any(String), type: 'paragraph', html: '' }];
    expect(parseHtml('')).toEqual(placeholder);
    expect(parseHtml('   ')).toEqual(placeholder);
    expect(parseHtml('<p></p>')).toEqual(placeholder);
    expect(isTransient(parseHtml('')[0])).toBe(true);
  });
});

/**
 * The budget is on the suite, not on each test, and it is deliberate.
 *
 * Each of the four properties runs 300 generated documents, and each run takes a
 * document through up to three full serialize → parse → sanitize cycles — the
 * slowest one does three round trips per run. That is over a thousand parses per
 * test, which is the right amount of work for a property that is the only thing
 * standing between a new block type and silent data loss.
 *
 * It does not fit Vitest's 5s default once `v8` instrumentation is on, and it
 * failed *intermittently* — a coverage run that passes or fails depending on
 * machine load. That is the worst kind of gate failure: it trains people to
 * re-run until green, which is exactly how a real regression gets through.
 *
 * So the budget is stated rather than the timeout raised globally. The
 * assertions and the run count are untouched; only the time the slow work is
 * allowed is made explicit.
 */
const PROPERTY_TIMEOUT_MS = 30_000;

describe('property: every serializable block survives a full round trip', () => {
  beforeEach(() => resetBlockIds());

  // This is the guarantee the whole editor rests on. If it holds for arbitrary
  // input, then no combination of authored content can be silently lost between
  // what the author sees, what is stored, and what is rendered.
  // ── Arbitrary generators ────────────────────────────────────────────────
  // A block's `html` field holds inline *HTML*, not text, so the arbitrary has
  // to produce canonical markup. A bare `&` is not a valid entity reference and
  // sanitize-html correctly rewrites it to `&amp;` — normalising the generated
  // value through the DOM keeps the property testing the domain the editor
  // actually operates on (content that has already been through a sanitizer).
  const canonical = (html: string): string => {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    return doc.body.innerHTML;
  };

  const inlineHtml = fc
    .array(
      fc.constantFrom(
        ...'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?;:\'"-–—/&%$#@()[]{}'
      ),
      { maxLength: 60 }
    )
    .map((chars) => canonical(chars.join('')));

  const richHtml = fc.oneof(
    inlineHtml,
    fc
      .tuple(inlineHtml, inlineHtml, fc.constantFrom('strong', 'em', 'b', 'i', 'code', 'u', 'span'))
      .map(([a, b, tag]) => canonical(`<${tag}>${a}</${tag}> ${b}`)),
    fc
      .tuple(inlineHtml, fc.constantFrom('https://indivisiblefairoaks.org', '/contact', '#top'))
      .map(([text, href]) => canonical(`<a href="${href}">${text}</a>`))
  );
  const nonEmpty = fc.stringMatching(/.*[A-Za-z0-9].*/s);

  // Rectangular, because that is what the serializer guarantees. Ragid input is
  // normalised on save (no cell dropped — see the dedicated case below), so the
  // header and every row are drawn from one shared column count.
  const rectangularTableArb = fc
    .record({
      columns: fc.integer({ min: 1, max: 3 }),
      head: fc.array(richHtml, { maxLength: 3 }),
      rows: fc.array(fc.array(richHtml, { maxLength: 3 }), { minLength: 1, maxLength: 3 }),
    })
    .chain(({ columns, head, rows }) =>
      fc.constant({
        type: 'table' as const,
        head: Array.from({ length: columns }, (_, i) => head[i] ?? ''),
        rows: rows.map((row) => Array.from({ length: columns }, (_, i) => row[i] ?? '')),
      })
    );

  const blockArb = fc.oneof(
    fc.record({ type: fc.constant('paragraph' as const), html: richHtml }),
    fc.record({
      type: fc.constant('heading' as const),
      level: fc.constantFrom(2, 3, 4, 5, 6),
      html: richHtml,
    }),
    fc.record({
      type: fc.constant('bulletList' as const),
      items: fc.array(richHtml, { minLength: 1, maxLength: 4 }),
    }),
    fc.record({
      type: fc.constant('orderedList' as const),
      items: fc.array(richHtml, { minLength: 1, maxLength: 4 }),
    }),
    fc.record({ type: fc.constant('quote' as const), html: richHtml }),
    fc.record({
      type: fc.constant('callout' as const),
      tone: fc.constantFrom(...CALLOUT_TONES),
      html: richHtml,
    }),
    fc.record({ type: fc.constant('code' as const), text: nonEmpty }),
    fc.record({
      type: fc.constant('image' as const),
      // Absolute only, and deliberately so: the editor resolves uploads to a
      // Supabase Storage public URL. A relative path is rewritten by
      // `sanitizeWPContent` step 9 on every render, so storing one would make the
      // document non-idempotent and each load would produce a new revision.
      src: fc.constantFrom('https://example.org/a.jpg', 'https://cdn.example.org/b.png'),
      alt: inlineHtml,
      caption: inlineHtml,
      width: fc.constantFrom(null, 640, 1200),
      height: fc.constantFrom(null, 480, 800),
    }),
    fc.record({ type: fc.constant('divider' as const) }),
    rectangularTableArb,
    fc.record({
      type: fc.constant('button' as const),
      label: nonEmpty,
      href: fc.constantFrom('/contact', '/events', 'https://indivisiblefairoaks.org/vote'),
    })
  );

  const withId = (b: Omit<Block, 'id'>): Block => ({ ...b, id: 'fixed' }) as Block;

  // A block that carries real content, so the exact round-trip assertion is
  // meaningful — empty blocks are dropped by design (see `serializeBlocks`).
  const populatedBlockArb = blockArb.filter(isPopulated);

  function isPopulated(b: Omit<Block, 'id'>): boolean {
    return !isBlockEmpty({ ...b, id: 'x' } as Block);
  }

  it(
    'parse(serialize(blocks)) === blocks for populated blocks',
    () => {
      fc.assert(
        fc.property(fc.array(populatedBlockArb, { minLength: 1, maxLength: 6 }), (blocks) => {
          const model = blocks.map(withId);
          expect(withoutIds(parseHtml(serializeBlocks(model)))).toEqual(withoutIds(model));
        }),
        { numRuns: 300 }
      );
    },
    PROPERTY_TIMEOUT_MS
  );

  it(
    'sanitize(serialize(blocks)) does not lose any block',
    () => {
      fc.assert(
        fc.property(fc.array(blockArb, { minLength: 1, maxLength: 6 }), (blocks) => {
          const model = blocks.map(withId);
          if (mentionsSpamKeyword(model)) return;
          const rendered = sanitizeWPContent(serializeBlocks(model));
          const kinds = (list: Block[]) => list.map((b) => b.type);
          // Empty blocks are legitimately dropped rather than persisted as markup
          // the sanitizer would delete anyway, so compare only the blocks that
          // actually carry content.
          const expected = kinds(model.filter((b) => !isBlockEmpty(b)));
          const reparsed = parseHtml(rendered);
          // An all-empty document parses to the single placeholder block the
          // editor types into, which is not part of the saved content.
          const actual =
            expected.length === 0 && reparsed.length === 1 && isTransient(reparsed[0])
              ? []
              : kinds(reparsed);
          expect(actual).toEqual(expected);
        }),
        { numRuns: 300 }
      );
    },
    PROPERTY_TIMEOUT_MS
  );

  it(
    'converges: the second save is byte-identical to the third',
    () => {
      // This is the guarantee an editing session actually depends on. Loading a
      // page, saving it, reloading and saving again must not keep mutating the
      // stored HTML — otherwise every visit rewrites the content and the revision
      // history fills with meaningless churn.
      fc.assert(
        fc.property(fc.array(blockArb, { minLength: 1, maxLength: 6 }), (blocks) => {
          const first = serializeBlocks(blocks.map(withId));
          const second = serializeBlocks(parseHtml(first));
          const third = serializeBlocks(parseHtml(second));
          expect(third).toBe(second);
        }),
        { numRuns: 300 }
      );
    },
    PROPERTY_TIMEOUT_MS
  );

  it(
    'never emits markup that the sanitizer then deletes',
    () => {
      fc.assert(
        fc.property(fc.array(blockArb, { minLength: 1, maxLength: 6 }), (blocks) => {
          const model = blocks.map(withId).filter((b) => !isBlockEmpty(b));
          if (model.length === 0) return;
          if (mentionsSpamKeyword(model)) return;
          const saved = serializeBlocks(model);
          expect(sanitizeWPContent(saved)).toBe(saved);
        }),
        { numRuns: 300 }
      );
    },
    PROPERTY_TIMEOUT_MS
  );
});

/**
 * Structure travels in `class`, because the sanitizer allows it and does not
 * allow `data-*`. That puts the block parser's markers in the same attribute as
 * every design utility, so the composer has to be able to tell them apart: a
 * design reset may replace the look, and the block must still parse as itself.
 */
describe('structural block classes', () => {
  it('separates cw markers from design classes on a wrapper', () => {
    const callout: Block = {
      id: 'callout-a',
      type: 'callout',
      tone: 'info',
      html: '<div class="cw-callout cw-callout--info p-4 my-2">Text</div>',
    };

    expect(structuralClassesOf(callout)).toBe('cw-callout cw-callout--info');
    expect(designClassesOf('cw-callout cw-callout--info p-4 my-2')).toBe('p-4 my-2');
  });

  it('matches the exact prefix, not a substring', () => {
    expect(designClassesOf('cwx custom-cw')).toBe('cwx custom-cw');
    expect(designClassesOf('cw')).toBe('');
  });

  it('is empty for a block with no wrapper', () => {
    expect(structuralClassesOf({ id: 'p', type: 'paragraph', html: 'Plain copy' })).toBe('');
  });
});

/**
 * The save shape.
 *
 * The live preview's whole promise is "what the page shows is what the save
 * writes". A block's design therefore lives on the element the page renders,
 * not on a `<div>` wrapped around it: a div inside a paragraph is not valid
 * HTML, and the browser splits it on re-parse. These pin the single owner: the
 * save writes the root, the parser reads the root, and the next save is the
 * same bytes.
 */
describe('block save shape', () => {
  const design = 'rounded-xl bg-white p-4';

  const types: { label: string; block: Block }[] = [
    { label: 'paragraph', block: { id: 'p', type: 'paragraph', html: 'Paragraph copy.' } },
    { label: 'heading', block: { id: 'h', type: 'heading', level: 2, html: 'Heading copy.' } },
    { label: 'bullet list', block: { id: 'ul', type: 'bulletList', items: ['One', 'Two'] } },
    { label: 'ordered list', block: { id: 'ol', type: 'orderedList', items: ['First', 'Second'] } },
    { label: 'quote', block: { id: 'q', type: 'quote', html: 'Quoted copy.' } },
    {
      label: 'callout',
      block: { id: 'callout', type: 'callout', tone: 'warning', html: 'Callout copy.' },
    },
    { label: 'code', block: { id: 'code', type: 'code', text: 'const answer = 42;' } },
    {
      label: 'image',
      block: {
        id: 'img',
        type: 'image',
        src: '/mission.jpg',
        alt: 'Volunteers',
        caption: 'A caption',
        width: 640,
        height: 480,
      },
    },
    { label: 'divider', block: { id: 'hr', type: 'divider' } },
    {
      label: 'table',
      block: {
        id: 'table',
        type: 'table',
        head: ['Name', 'Role'],
        rows: [['Ada', 'Organizer']],
      },
    },
    {
      label: 'button',
      block: { id: 'button', type: 'button', label: 'Join us', href: '/contact' },
    },
  ];

  const savedHtml = (block: Block): string =>
    serializeBlocks([applyBlockShell(block, { customClasses: design })]);

  it('puts the design on every block type’s own root and round-trips it', () => {
    for (const { label, block } of types) {
      const saved = savedHtml(block);

      // No block-level wrapper inside a root that cannot contain one. This is
      // the exact shape the composer used to save for a paragraph, and the
      // browser split it into an empty paragraph plus a div.
      expect(saved, label).not.toMatch(
        /<(p|h[1-6]|blockquote|pre|ul|ol|table|figure)\b[^>]*>\s*<div\b/i
      );

      // The sanitizer is on the save path, so a design that it would strip is a
      // design the editor must not offer. The root attributes are what make the
      // save survive it.
      expect(sanitizeWPContent(saved), label).toBe(saved);

      const parsed = parseHtml(saved);
      expect(parsed, label).toHaveLength(1);
      expect(parsed[0].type, label).toBe(block.type);
      expect(readBlockShell(parsed[0])?.className, label).toBe(design);

      // The round trip the editor depends on: the page re-reads its own save as
      // the same blocks and writes the same bytes back.
      expect(serializeBlocks(parsed), label).toBe(saved);
    }
  });

  it('writes a paragraph’s design on the paragraph, not around it', () => {
    const paragraph = parseHtml('<p>Copy</p>')[0];
    const saved = applyBlockShell(paragraph, {
      anchorId: 'mission',
      customClasses: 'text-lg',
      customStyle: 'color: red;',
    });

    expect(serializeBlocks([saved])).toBe(
      '<p id="mission" class="text-lg" style="color: red;">Copy</p>'
    );
    expect(readBlockShell(saved)).toMatchObject({
      className: 'text-lg',
      anchorId: 'mission',
      style: 'color: red;',
    });
  });

  it('keeps a divider a divider when it gets a design', () => {
    const saved = applyBlockShell({ id: 'hr', type: 'divider' }, { customClasses: 'my-8' });

    expect(saved.type).toBe('divider');
    expect(serializeBlocks([saved])).toBe('<hr class="my-8 cw-divider" />');
    expect(serializeBlocks(parseHtml(serializeBlocks([saved])))).toBe(
      '<hr class="my-8 cw-divider" />'
    );
  });

  it('does not mistake a callout’s authored div for a design wrapper', () => {
    const block = parseHtml(
      '<div class="cw-callout cw-callout--info"><div class="note">Text</div></div>'
    )[0];
    expect(block.type).toBe('callout');
    if (block.type !== 'callout') return;
    expect(block.html).toBe('<div class="note">Text</div>');

    const saved = serializeBlocks([applyBlockShell(block, { customClasses: 'p-4' })]);
    expect(saved).toBe(
      '<div class="p-4 cw-callout cw-callout--info"><div class="note">Text</div></div>'
    );
    expect(serializeBlocks(parseHtml(saved))).toBe(saved);
  });

  it('replaces an unsupported block’s wrapper instead of stacking a second one', () => {
    const form: Block = {
      id: 'u',
      type: 'unsupported',
      html: '<form><input name="email" /></form>',
    };

    const once = applyBlockShell(form, { customClasses: 'p-4' });
    const twice = applyBlockShell(once, { customClasses: 'p-6' });
    const html = 'html' in twice ? twice.html : '';

    expect(html).toContain('<div class="p-6"><form>');
    expect(html).not.toContain('p-4');
    expect(parseHtml(html)[0].type).toBe('unsupported');
  });

  it('lifts the previous composer’s wrapper onto the block root on parse', () => {
    const legacyList = parseHtml(
      '<div class="rounded-xl"><ul class="cw-list cw-list--bullet"><li>One</li></ul></div>'
    );
    expect(legacyList).toHaveLength(1);
    expect(legacyList[0].type).toBe('bulletList');
    expect(readBlockShell(legacyList[0])?.className).toBe('rounded-xl');
    expect(serializeBlocks(legacyList)).toBe(
      '<ul class="rounded-xl cw-list cw-list--bullet"><li>One</li></ul>'
    );

    const legacyHeading = parseHtml(
      '<div class="text-3xl"><h2 class="cw cw--h2">Mission</h2></div>'
    );
    expect(legacyHeading[0].type).toBe('heading');
    expect(readBlockShell(legacyHeading[0])?.className).toBe('text-3xl');
    expect(serializeBlocks(legacyHeading)).toBe('<h2 class="text-3xl cw cw--h2">Mission</h2>');
  });

  it('gives the preview the same structural classes the serializer writes', () => {
    expect(structuralClassesForBlock({ id: 'h', type: 'heading', level: 3, html: '' })).toBe(
      'cw cw--h3'
    );
    expect(structuralClassesForBlock({ id: 'l', type: 'bulletList', items: [] })).toBe(
      'cw-list cw-list--bullet'
    );
    expect(structuralClassesForBlock({ id: 'c', type: 'callout', tone: 'info', html: '' })).toBe(
      'cw-callout cw-callout--info'
    );
    expect(structuralClassesForBlock({ id: 'b', type: 'button', label: '', href: '' })).toBe(
      'cw-action'
    );
  });

  it('drops an empty paragraph even when it carries a design', () => {
    const styledEmpty = applyBlockShell(
      { id: 'p', type: 'paragraph', html: '' },
      {
        customClasses: 'p-4',
      }
    );

    expect(isBlockEmpty(styledEmpty)).toBe(true);
    expect(serializeBlocks([styledEmpty])).toBe('<p></p>');
  });

  it('round-trips every theme from the compiler token to the saved attribute', () => {
    for (const mode of ['dark', 'light', 'system'] as const) {
      const tokens = themeClassTokens(mode);
      const attribute = themeAttributesFor(mode);
      expect(attribute).not.toBeNull();

      // The compiler writes these tokens; the save reads the same tokens back.
      expect(themeModeFromClassList(tokens)).toBe(mode);
      const saved = serializeBlocks([
        applyBlockShell(parseHtml('<p>Copy</p>')[0], { customClasses: `p-4 ${tokens}` }),
      ]);
      expect(saved).toContain(` ${attribute?.name}="${attribute?.value}"`);
      expect(readBlockShell(parseHtml(saved)[0])?.themeMode).toBe(mode);
      expect(serializeBlocks(parseHtml(saved))).toBe(saved);
    }
  });

  it('writes no theme attribute for inherit or for nothing at all', () => {
    expect(themeClassTokens('inherit')).toBe('');
    expect(themeClassTokens(undefined)).toBe('');
    expect(themeAttributesFor('inherit')).toBeNull();
    expect(themeModeFromClassList('p-4')).toBeNull();
    const saved = serializeBlocks([
      applyBlockShell(parseHtml('<p>Copy</p>')[0], { customClasses: 'p-4' }),
    ]);
    expect(saved).not.toContain('data-theme');
  });
});

describe('rows', () => {
  beforeEach(() => resetBlockIds());

  const row: Block = {
    id: 'r',
    type: 'row',
    columns: [
      {
        id: 'c1',
        blocks: [
          { id: 'h', type: 'heading', level: 2, html: 'Agenda' },
          { id: 'p', type: 'paragraph', html: 'Doors at nine.' },
        ],
      },
      {
        id: 'c2',
        blocks: [{ id: 'l', type: 'bulletList', items: ['Water', 'Sun hat'] }],
      },
    ],
  };

  it('serializes a two-column row with real blocks in both columns', () => {
    expect(serializeBlocks([row])).toBe(
      '<div class="cw-row cw-row--2">' +
        '<div class="cw-column"><h2 class="cw cw--h2">Agenda</h2><p>Doors at nine.</p></div>' +
        '<div class="cw-column"><ul class="cw-list cw-list--bullet"><li>Water</li><li>Sun hat</li></ul></div>' +
        '</div>'
    );
  });

  it('survives the sanitizer and parses back to the same row', () => {
    const saved = serializeBlocks([row]);
    const sanitized = sanitizeWPContent(saved);

    // The sanitizer is the storage boundary: whatever it drops, the save has lost.
    expect(sanitized).toBe(saved);

    const parsed = parseHtml(sanitized);
    expect(parsed).toHaveLength(1);
    const parsedRow = parsed[0];
    if (parsedRow.type !== 'row') throw new Error('expected a row');
    expect(parsedRow.columns).toHaveLength(2);
    expect(parsedRow.columns[0].blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
    ]);
    expect(parsedRow.columns[1].blocks.map((block) => block.type)).toEqual(['bulletList']);
    expect(serializeBlocks(parsed)).toBe(saved);
  });

  it('keeps a row’s design on the row and its structure out of the design field', () => {
    const styled: Block = { ...row, shell: { className: 'rounded-2xl bg-surface p-6' } };
    const saved = serializeBlocks([styled]);

    expect(saved).toContain('<div class="rounded-2xl bg-surface p-6 cw-row cw-row--2">');
    expect(readBlockShell(parseHtml(saved)[0])?.className).toBe('rounded-2xl bg-surface p-6');
    expect(serializeBlocks(parseHtml(saved))).toBe(saved);
  });

  it('emits the column count as structure for one and three columns', () => {
    const one = createRowBlock('one', 1);
    one.columns[0].blocks.push({ id: 'p1', type: 'paragraph', html: 'One' });
    const three = createRowBlock('three', 3);
    three.columns[2].blocks.push({ id: 'p3', type: 'paragraph', html: 'Three' });

    expect(serializeBlocks([one])).toContain('class="cw-row cw-row--1"');
    expect(serializeBlocks([three])).toContain('class="cw-row cw-row--3"');
    expect(createRowBlock('clamped-low', 0).columns).toHaveLength(1);
    expect(createRowBlock('clamped-high', 9).columns).toHaveLength(3);
  });

  it('leaves a flat legacy body untouched', () => {
    const legacy = '<p>Intro</p><h2 class="cw cw--h2">Mission</h2>';
    const parsed = parseHtml(legacy);

    expect(parsed.map((block) => block.type)).toEqual(['paragraph', 'heading']);
    expect(parsed.some((block) => block.type === 'row')).toBe(false);
    expect(serializeBlocks(parsed)).toBe(legacy);
  });

  it('keeps an unwrapped legacy list a list, with its items', () => {
    const parsed = parseHtml('<ul><li>One</li><li>Two</li></ul>');
    expect(parsed[0].type).toBe('bulletList');
    if (parsed[0].type !== 'bulletList') throw new Error('expected a list');
    expect(parsed[0].items).toEqual(['One', 'Two']);
    // The parser recognises a bare list; the save writes the structural class
    // that makes it recognisable next time. The content is unchanged.
    expect(serializeBlocks(parsed)).toBe(
      '<ul class="cw-list cw-list--bullet"><li>One</li><li>Two</li></ul>'
    );
  });

  it('preserves a nested row as unsupported markup rather than a second level', () => {
    const nested =
      '<div class="cw-row cw-row--2">' +
      '<div class="cw-column"><p>Left</p></div>' +
      '<div class="cw-column"><div class="cw-row cw-row--1"><div class="cw-column"><p>Too deep</p></div></div></div>' +
      '</div>';
    const parsed = parseHtml(nested);

    expect(parsed).toHaveLength(1);
    const outer = parsed[0];
    if (outer.type !== 'row') throw new Error('expected a row');
    expect(outer.columns[1].blocks).toHaveLength(1);
    expect(outer.columns[1].blocks[0].type).toBe('unsupported');
    expect(serializeBlocks(parsed)).toBe(nested);
  });

  it('preserves a row with no columns as unsupported', () => {
    const malformed = '<div class="cw-row cw-row--2"><p>Orphan</p></div>';
    const parsed = parseHtml(malformed);
    expect(parsed[0].type).toBe('unsupported');
    expect(serializeBlocks(parsed)).toBe(malformed);
  });

  it('drops an empty row from the save, like an empty paragraph', () => {
    const empty = createRowBlock('empty', 2);
    expect(isBlockEmpty(empty)).toBe(true);
    expect(serializeBlocks([empty])).toBe('<p></p>');
  });

  it('keeps an empty column inside a row that has content elsewhere', () => {
    const partial = createRowBlock('partial', 2);
    partial.columns[0].blocks.push({ id: 'copy', type: 'paragraph', html: 'Only here' });
    const saved = serializeBlocks([partial]);

    expect(saved).toContain('<div class="cw-column"><p>Only here</p></div>');
    expect(saved).toContain('<div class="cw-column"></div>');
    // The blank column has to survive storage, or a deliberate gap becomes a
    // collapsed grid on the next load.
    expect(sanitizeWPContent(saved)).toBe(saved);
    expect(serializeBlocks(parseHtml(saved))).toBe(saved);
  });

  it('gives every nested block a fresh id when duplicating a row', () => {
    const copy = cloneBlockWithFreshIds(row);
    if (copy.type !== 'row') throw new Error('expected a row');

    expect(copy.id).not.toBe(row.id);
    const original = (row as Extract<Block, { type: 'row' }>).columns;
    expect(copy.columns[0].id).not.toBe(original[0].id);
    expect(copy.columns[0].blocks[0].id).not.toBe(original[0].blocks[0].id);
    expect(serializeBlocks([copy])).toBe(serializeBlocks([row]));
  });
});
