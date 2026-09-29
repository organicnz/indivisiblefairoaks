import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  type Block,
  blockText,
  CALLOUT_TONES,
  isBlockEmpty,
  isTextualBlock,
  isTransient,
  parseHtml,
  resetBlockIds,
  serializeBlocks,
  stripTags,
} from '@/lib/blocks';
import { sanitizeWPContent } from '@/lib/sanitize';

/** Block identity is session-scoped and irrelevant to round-trip equality. */
function withoutIds(blocks: Block[]) {
  return blocks.map(({ id: _id, ...rest }) => rest);
}

function fixture(block: Block): string {
  return serializeBlocks([block]);
}

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

  it('parse(serialize(blocks)) === blocks for populated blocks', () => {
    fc.assert(
      fc.property(fc.array(populatedBlockArb, { minLength: 1, maxLength: 6 }), (blocks) => {
        const model = blocks.map(withId);
        expect(withoutIds(parseHtml(serializeBlocks(model)))).toEqual(withoutIds(model));
      }),
      { numRuns: 300 }
    );
  });

  it('sanitize(serialize(blocks)) does not lose any block', () => {
    fc.assert(
      fc.property(fc.array(blockArb, { minLength: 1, maxLength: 6 }), (blocks) => {
        const model = blocks.map(withId);
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
  });

  it('converges: the second save is byte-identical to the third', () => {
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
  });

  it('never emits markup that the sanitizer then deletes', () => {
    fc.assert(
      fc.property(fc.array(blockArb, { minLength: 1, maxLength: 6 }), (blocks) => {
        const model = blocks.map(withId).filter((b) => !isBlockEmpty(b));
        if (model.length === 0) return;
        const saved = serializeBlocks(model);
        expect(sanitizeWPContent(saved)).toBe(saved);
      }),
      { numRuns: 300 }
    );
  });
});
