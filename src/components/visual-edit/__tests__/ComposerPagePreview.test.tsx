// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type ComposerDraftPreview,
  type ComposerPagePreviewControls,
  useComposerPagePreview,
} from '@/components/visual-edit/useComposerPagePreview';
import {
  applyBlockShell,
  type Block,
  type BlockShellDesign,
  serializeBlocks,
  structuralClassesForBlock,
} from '@/lib/blocks';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The preview must paint the serializer's own output.
 *
 * These tests are a contract, not a snapshot of today's classes: for every
 * block type the composer can produce, the live element after `applyDraft` has
 * to carry exactly the root attributes and inner markup `serializeBlocks`
 * writes after `applyBlockShell`. If the two paths drift, one of these fails
 * with the block type name attached.
 */
const DESIGN: BlockShellDesign = {
  customClasses:
    'text-2xl font-black tracking-tight rounded-2xl shadow-lg [data-theme=dark] [color-scheme=dark]',
  customStyle: 'color: rgb(1, 2, 3)',
};

/** Every type the composer can insert. `unsupported` is a parse fallback. */
const BLOCKS: Record<string, Block> = {
  paragraph: { id: 'p', type: 'paragraph', html: 'Body <strong>copy</strong>' },
  heading: { id: 'h', type: 'heading', level: 3, html: 'Headline' },
  bulletList: { id: 'ul', type: 'bulletList', items: ['One', '<em>Two</em>'] },
  orderedList: { id: 'ol', type: 'orderedList', items: ['First', 'Second'] },
  quote: { id: 'q', type: 'quote', html: 'A quote' },
  callout: { id: 'c', type: 'callout', tone: 'action', html: 'Do the thing' },
  code: { id: 'code', type: 'code', text: 'const x = 1 < 2;' },
  image: {
    id: 'img',
    type: 'image',
    src: '/a.jpg',
    alt: 'Alt',
    caption: 'Caption',
    width: 1200,
    height: 800,
  },
  divider: { id: 'hr', type: 'divider' },
  table: { id: 't', type: 'table', head: ['A', 'B'], rows: [['1', '2']] },
  button: { id: 'btn', type: 'button', label: 'Join', href: '/join' },
  row: {
    id: 'row',
    type: 'row',
    columns: [
      { id: 'r1', blocks: [{ id: 'rp', type: 'paragraph', html: 'Left' }] },
      { id: 'r2', blocks: [] },
    ],
  },
};

type ControlsRef = { current: ComposerPagePreviewControls | null };

function Harness({
  elements,
  blocks,
  controls,
}: {
  elements: HTMLElement[];
  blocks: Block[];
  controls: ControlsRef;
}) {
  const preview = useComposerPagePreview({
    resolveElement: (index) => elements[index] ?? null,
    blockAt: (index) => blocks[index] ?? null,
  });
  controls.current = preview;
  return null;
}

/** Parse the one top-level element a block serializes to. */
function parseOne(html: string): HTMLElement {
  const template = document.createElement('template');
  template.innerHTML = html;
  const element = template.content.firstElementChild;
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected one element from ${html}`);
  }
  return element;
}

function attrsOf(element: HTMLElement) {
  return {
    class: element.getAttribute('class'),
    style: element.getAttribute('style'),
    theme: element.getAttribute('data-theme'),
    themeMode: element.getAttribute('data-theme-mode'),
    html: element.innerHTML,
  };
}

describe('useComposerPagePreview', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  async function mount(elements: HTMLElement[], blocks: Block[]): Promise<ControlsRef> {
    const controls: ControlsRef = { current: null };
    await act(async () => {
      root.render(<Harness elements={elements} blocks={blocks} controls={controls} />);
    });
    return controls;
  }

  it('paints the serializer root for every block type the composer can produce', async () => {
    const blocks = Object.values(BLOCKS);
    const elements = blocks.map((block) => {
      const element = parseOne(serializeBlocks([block]));
      document.body.appendChild(element);
      return element;
    });
    const controls = await mount(elements, blocks);

    const draft: ComposerDraftPreview = {
      mode: 'block',
      blockIndexes: blocks.map((_, index) => index),
      design: DESIGN,
      contentHtml: null,
    };
    act(() => controls.current?.applyDraft(draft));

    blocks.forEach((block, index) => {
      const saved = parseOne(serializeBlocks([applyBlockShell(block, DESIGN)]));
      expect(attrsOf(elements[index]), block.type).toEqual(attrsOf(saved));
    });
  });

  it('clears a theme the draft class list does not encode', async () => {
    const block: Block = {
      id: 'themed',
      type: 'heading',
      level: 2,
      html: 'Themed',
      shell: {
        className: 'text-3xl [data-theme=dark] [color-scheme:dark]',
        style: 'letter-spacing: 0.01em',
      },
    };
    const element = parseOne(serializeBlocks([block]));
    document.body.appendChild(element);
    const controls = await mount([element], [block]);

    // `data-theme` is derived from the class list, exactly as the save does it.
    // A preview that trusted the editor's theme field instead would keep dark
    // here even though the serialized block has no theme token at all.
    const design: BlockShellDesign = { customClasses: 'text-xl' };
    act(() =>
      controls.current?.applyDraft({
        mode: 'block',
        blockIndexes: [0],
        design,
        contentHtml: null,
      })
    );

    const saved = parseOne(serializeBlocks([applyBlockShell(block, design)]));
    expect(attrsOf(element)).toEqual(attrsOf(saved));
    expect(element.getAttribute('data-theme')).toBeNull();
  });

  it('paints draft copy without restyling, and puts it back on clear', async () => {
    const block = BLOCKS.heading;
    const element = parseOne(serializeBlocks([block]));
    document.body.appendChild(element);
    const controls = await mount([element], [block]);
    const before = attrsOf(element);

    act(() =>
      controls.current?.applyDraft({
        mode: 'block',
        blockIndexes: [0],
        design: null,
        contentHtml: 'A new <strong>mission</strong>',
      })
    );
    expect(element.innerHTML).toBe('A new <strong>mission</strong>');
    // A copy edit alone must not apply the editor's default design.
    expect(attrsOf(element)).toEqual({ ...before, html: element.innerHTML });

    act(() => controls.current?.applyDraft(null));
    expect(attrsOf(element)).toEqual(before);
  });

  it('repaints a row’s column count so the page cannot show the old grid', async () => {
    const row: Block = {
      id: 'growing-row',
      type: 'row',
      shell: { className: 'rounded-2xl bg-surface-muted' },
      columns: [
        { id: 'g1', blocks: [{ id: 'gp1', type: 'paragraph', html: 'Left' }] },
        { id: 'g2', blocks: [] },
      ],
    };
    const element = parseOne(serializeBlocks([row]));
    document.body.appendChild(element);
    const controls = await mount([element], [row]);
    const before = attrsOf(element);

    const grown: Block = {
      ...row,
      columns: [
        ...row.columns,
        { id: 'g3', blocks: [{ id: 'gp3', type: 'paragraph', html: 'Right' }] },
      ],
    };
    const saved = parseOne(serializeBlocks([grown]));

    act(() =>
      controls.current?.applyDraft({
        mode: 'block',
        blockIndexes: [0],
        design: null,
        contentHtml: saved.innerHTML,
        contentRootClassName: structuralClassesForBlock(grown),
      })
    );

    // The page must match the save, not just the mini-preview: three columns in
    // a `cw-row--2` grid is a layout the writer never stores.
    expect(attrsOf(element)).toEqual(attrsOf(saved));
    expect(element.classList.contains('cw-row--2')).toBe(false);

    act(() => controls.current?.applyDraft(null));
    expect(attrsOf(element)).toEqual(before);
  });

  it('restores a committed apply to the design that was written', async () => {
    const block: Block = {
      id: 'c',
      type: 'callout',
      tone: 'info',
      html: 'Original',
      shell: { className: 'text-base', style: 'color: blue' },
    };
    const element = parseOne(serializeBlocks([block]));
    document.body.appendChild(element);
    const controls = await mount([element], [block]);

    act(() =>
      controls.current?.applyDraft({
        mode: 'block',
        blockIndexes: [0],
        design: DESIGN,
        contentHtml: null,
      })
    );
    const applied = attrsOf(element);
    act(() => controls.current?.commitDraft([0]));
    act(() => controls.current?.applyDraft(null));

    // Closing after Apply no longer snaps back to the old look; the committed
    // attributes are the base a later discard restores to.
    expect(attrsOf(element)).toEqual(applied);
  });
});
