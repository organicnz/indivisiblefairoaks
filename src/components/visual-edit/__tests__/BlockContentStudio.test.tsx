// @vitest-environment jsdom
'use client';

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BlockContentStudio,
  BlockTypeConverter,
  ButtonBlockEditor,
  CalloutBlockEditor,
  CodeBlockEditor,
  DividerBlockEditor,
  HeadingBlockEditor,
  ImageBlockEditor,
  ListBlockEditor,
  ParagraphBlockEditor,
  QuoteBlockEditor,
  TableBlockEditor,
  UnsupportedBlockEditor,
} from '@/components/visual-edit/composer/BlockContentStudio';
import { type Block, serializeBlocks } from '@/lib/blocks';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('BlockContentStudio & Modular Block Editors', () => {
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
    vi.restoreAllMocks();
  });

  it('renders BlockTypeConverter and converts element type', async () => {
    const block: Block = { id: 'b1', type: 'paragraph', html: 'Hello Civic' };
    const setCurrentBlock = vi.fn();

    await act(async () => {
      root.render(<BlockTypeConverter currentBlock={block} setCurrentBlock={setCurrentBlock} />);
    });

    expect(container.textContent).toContain('Element Type & Conversion');
    expect(container.textContent).toContain('PARAGRAPH');

    // Click Heading button to convert
    const headingBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Heading')
    );
    expect(headingBtn).toBeDefined();

    act(() => {
      headingBtn?.click();
    });

    expect(setCurrentBlock).toHaveBeenCalled();
  });

  it('renders HeadingBlockEditor and updates level and text', async () => {
    const block: Extract<Block, { type: 'heading' }> = {
      id: 'b2',
      type: 'heading',
      level: 2,
      html: 'Rally Tomorrow',
    };
    const setCurrentBlock = vi.fn();

    await act(async () => {
      root.render(
        <HeadingBlockEditor
          currentBlock={block}
          setCurrentBlock={setCurrentBlock}
          headingTextId="heading-input"
        />
      );
    });

    expect(container.textContent).toContain('Heading Level');
    expect(container.textContent).toContain('H1');
    expect(container.textContent).toContain('H2');

    // Click H3 button
    const h3Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('H3')
    );
    expect(h3Btn).toBeDefined();

    act(() => {
      h3Btn?.click();
    });

    expect(setCurrentBlock).toHaveBeenCalledWith(expect.objectContaining({ level: 3 }));
  });

  it('renders ParagraphBlockEditor and updates text', async () => {
    const block: Extract<Block, { type: 'paragraph' }> = {
      id: 'b3',
      type: 'paragraph',
      html: 'Initial body text',
    };
    const setCurrentBlock = vi.fn();

    await act(async () => {
      root.render(
        <ParagraphBlockEditor
          currentBlock={block}
          setCurrentBlock={setCurrentBlock}
          paragraphTextId="para-input"
        />
      );
    });

    expect(container.textContent).toContain('Paragraph');
    const editor = container.querySelector('#para-input') as HTMLDivElement;
    expect(editor).not.toBeNull();
    expect(editor.textContent).toBe('Initial body text');

    act(() => {
      editor.innerHTML = 'Updated paragraph';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(setCurrentBlock).toHaveBeenCalledWith(
      expect.objectContaining({ html: 'Updated paragraph' })
    );
  });

  it('renders ImageBlockEditor and updates width/height dimensions', async () => {
    const block: Extract<Block, { type: 'image' }> = {
      id: 'b4',
      type: 'image',
      src: 'https://example.com/photo.jpg',
      alt: 'Civic Rally',
      caption: 'Organizers at Carmichael',
      width: 1200,
      height: 630,
    };
    const setCurrentBlock = vi.fn();

    await act(async () => {
      root.render(
        <ImageBlockEditor
          currentBlock={block}
          setCurrentBlock={setCurrentBlock}
          imageSrcId="img-src"
          imageAltId="img-alt"
          imageCaptionId="img-caption"
        />
      );
    });

    expect(container.textContent).toContain('Image URL');
    expect(container.textContent).toContain('Intrinsic Width (px)');
    expect(container.textContent).toContain('Intrinsic Height (px)');

    const inputs = container.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThan(3);
  });

  it('renders ButtonBlockEditor and updates destination href', async () => {
    const block: Extract<Block, { type: 'button' }> = {
      id: 'b5',
      type: 'button',
      label: 'Sign Up',
      href: '/join',
    };
    const setCurrentBlock = vi.fn();

    await act(async () => {
      root.render(
        <ButtonBlockEditor
          currentBlock={block}
          setCurrentBlock={setCurrentBlock}
          buttonLabelId="btn-label"
          buttonHrefId="btn-href"
        />
      );
    });

    expect(container.textContent).toContain('Button Label');
    expect(container.textContent).toContain('Destination URL');
    expect(container.textContent).toContain('Quick Destination Links');
    expect(container.textContent).toContain('Events Calendar');

    const eventsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Events Calendar')
    );
    expect(eventsBtn).toBeDefined();

    act(() => {
      eventsBtn?.click();
    });

    expect(setCurrentBlock).toHaveBeenCalledWith(expect.objectContaining({ href: '/events' }));
  });

  it('renders CalloutBlockEditor and selects action tone', async () => {
    const block: Extract<Block, { type: 'callout' }> = {
      id: 'b6',
      type: 'callout',
      tone: 'info',
      html: 'Important bulletin',
    };
    const setCurrentBlock = vi.fn();

    await act(async () => {
      root.render(
        <CalloutBlockEditor
          currentBlock={block}
          setCurrentBlock={setCurrentBlock}
          calloutTextId="callout-text"
        />
      );
    });

    expect(container.textContent).toContain('Callout Tone');
    expect(container.textContent).toContain('action');

    const actionBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('action')
    );
    expect(actionBtn).toBeDefined();

    act(() => {
      actionBtn?.click();
    });

    expect(setCurrentBlock).toHaveBeenCalledWith(expect.objectContaining({ tone: 'action' }));
  });

  it('renders Quote, List, Code, Table, and Divider editors without errors', async () => {
    const setCurrentBlock = vi.fn();

    // Quote
    const quoteBlock: Extract<Block, { type: 'quote' }> = {
      id: 'b7',
      type: 'quote',
      html: 'Democracy is not a spectator sport.',
    };
    await act(async () => {
      root.render(<QuoteBlockEditor currentBlock={quoteBlock} setCurrentBlock={setCurrentBlock} />);
    });
    expect(container.textContent).toContain('Quote Content');

    // List
    const listBlock: Extract<Block, { type: 'bulletList' }> = {
      id: 'b8',
      type: 'bulletList',
      items: ['Vote', 'Organize', 'Donate'],
    };
    await act(async () => {
      root.render(<ListBlockEditor currentBlock={listBlock} setCurrentBlock={setCurrentBlock} />);
    });
    expect(container.textContent).toContain('List Items');
    expect(container.textContent).toContain('Vote');

    // Code
    const codeBlock: Extract<Block, { type: 'code' }> = {
      id: 'b9',
      type: 'code',
      text: 'bun run test',
    };
    await act(async () => {
      root.render(<CodeBlockEditor currentBlock={codeBlock} setCurrentBlock={setCurrentBlock} />);
    });
    expect(container.textContent).toContain('Code Snippet');

    // Table
    const tableBlock: Extract<Block, { type: 'table' }> = {
      id: 'b10',
      type: 'table',
      head: ['Event', 'Location'],
      rows: [['Meeting', 'Fair Oaks']],
    };
    await act(async () => {
      root.render(<TableBlockEditor currentBlock={tableBlock} setCurrentBlock={setCurrentBlock} />);
    });
    expect(container.textContent).toContain('Table Columns');

    // Divider
    await act(async () => {
      root.render(<DividerBlockEditor />);
    });
    expect(container.textContent).toContain('Horizontal Section Divider');

    // Unsupported
    const unsupportedBlock: Extract<Block, { type: 'unsupported' }> = {
      id: 'b11',
      type: 'unsupported',
      html: '<svg></svg>',
    };
    await act(async () => {
      root.render(
        <UnsupportedBlockEditor currentBlock={unsupportedBlock} setCurrentBlock={setCurrentBlock} />
      );
    });
    expect(container.textContent).toContain('Raw HTML Markup');
  });

  it('renders composed BlockContentStudio correctly for heading block', async () => {
    const block: Block = { id: 'b12', type: 'heading', level: 1, html: 'Fair Oaks Indivisible' };
    const setCurrentBlock = vi.fn();

    await act(async () => {
      root.render(<BlockContentStudio currentBlock={block} setCurrentBlock={setCurrentBlock} />);
    });

    expect(container.textContent).toContain('Element Type & Conversion');
    expect(container.textContent).toContain('HEADING');
    expect(container.textContent).toContain('Element Content & Copy');
    expect(container.textContent).toContain('Heading Level');
  });

  it('renders a row as columns and names an empty column rather than a bare frame', async () => {
    const row: Block = {
      id: 'r',
      type: 'row',
      columns: [
        { id: 'c1', blocks: [] },
        { id: 'c2', blocks: [] },
      ],
    };

    await act(async () => {
      root.render(<RowHarness initial={row} />);
    });

    expect(container.textContent).toContain('Row Layout');
    expect(container.textContent).toContain('2 columns');
    expect(container.querySelectorAll('[data-testid^="row-column-"]')).toHaveLength(2);
    expect(container.textContent?.match(/Empty column\. Add a block below\./g)).toHaveLength(2);
    expect(container.textContent).toContain('A row lays blocks side by side');
  });

  it('adds a block to a column and serializes the result', async () => {
    const committed: Block[] = [];
    const row: Block = {
      id: 'r',
      type: 'row',
      columns: [
        { id: 'c1', blocks: [] },
        { id: 'c2', blocks: [] },
      ],
    };

    await act(async () => {
      root.render(<RowHarness initial={row} onCommit={(next) => committed.push(next)} />);
    });

    const select = container.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      select.value = 'heading';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const last = expectRow(committed.at(-1));
    expect(last.columns[0].blocks).toHaveLength(1);
    expect(last.columns[0].blocks[0].type).toBe('heading');
    expect(last.columns[1].blocks).toHaveLength(0);
    expect(serializeBlocks([last])).toContain(
      '<div class="cw-column"><h2 class="cw cw--h2">New Section Heading</h2></div>'
    );
  });

  it('reorders and deletes blocks inside a column without touching the other one', async () => {
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
        { id: 'c2', blocks: [{ id: 'q', type: 'quote', html: 'A quote' }] },
      ],
    };
    const committed: Block[] = [];

    await act(async () => {
      root.render(<RowHarness initial={row} onCommit={(next) => committed.push(next)} />);
    });

    await act(async () => {
      (
        container.querySelector('[aria-label="Move Doors at nine. up"]') as HTMLButtonElement
      ).click();
    });
    const moved = expectRow(committed.at(-1));
    expect(moved.columns[0].blocks.map((block) => block.type)).toEqual(['paragraph', 'heading']);
    expect(moved.columns[1].blocks.map((block) => block.type)).toEqual(['quote']);

    await act(async () => {
      (container.querySelector('[aria-label="Delete Agenda"]') as HTMLButtonElement).click();
    });
    const confirmDelete = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Delete'
    );
    expect(confirmDelete).toBeDefined();
    await act(async () => {
      confirmDelete?.click();
    });
    const deleted = expectRow(committed.at(-1));
    expect(deleted.columns[0].blocks.map((block) => block.type)).toEqual(['paragraph']);
    expect(deleted.columns[1].blocks).toHaveLength(1);
  });

  it('edits a nested block in place, keeping the row selected', async () => {
    const row: Block = {
      id: 'r',
      type: 'row',
      columns: [{ id: 'c1', blocks: [{ id: 'p', type: 'paragraph', html: 'Doors at nine.' }] }],
    };
    const committed: Block[] = [];

    await act(async () => {
      root.render(<RowHarness initial={row} onCommit={(next) => committed.push(next)} />);
    });

    // The row stays the selected block: the composition controls stay on screen.
    expect(container.textContent).toContain('1 column');
    await act(async () => {
      (
        container.querySelector('[aria-label="Edit Doors at nine. content"]') as HTMLButtonElement
      ).click();
    });
    expect(container.textContent).toContain('Element Content & Copy');

    const convert = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Button'
    );
    await act(async () => {
      (convert as HTMLButtonElement).click();
    });

    const last = expectRow(committed.at(-1));
    expect(last.columns[0].blocks[0].type).toBe('button');
    expect(container.textContent).toContain('Row Layout');
  });

  it('adds an empty column at the end', async () => {
    const row: Block = {
      id: 'r',
      type: 'row',
      columns: [
        { id: 'c1', blocks: [{ id: 'h', type: 'heading', level: 2, html: 'Agenda' }] },
        { id: 'c2', blocks: [{ id: 'p', type: 'paragraph', html: 'Doors at nine.' }] },
      ],
    };
    const committed: Block[] = [];

    await act(async () => {
      root.render(<RowHarness initial={row} onCommit={(next) => committed.push(next)} />);
    });

    await act(async () => {
      (container.querySelector('[aria-label="Add column"]') as HTMLButtonElement).click();
    });
    const grown = expectRow(committed.at(-1));
    expect(grown.columns).toHaveLength(3);
    expect(grown.columns[2].blocks).toEqual([]);
    expect(container.querySelectorAll('[data-testid^="row-column-"]')).toHaveLength(3);
  });

  it('reorders columns with left and right buttons', async () => {
    const committed: Block[] = [];
    await act(async () => {
      root.render(
        <RowHarness initial={THREE_COLUMN_ROW} onCommit={(next) => committed.push(next)} />
      );
    });

    const moveRight = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Move column 1 right"]'
    );
    expect(moveRight).not.toBeNull();

    act(() => {
      moveRight?.click();
    });

    const reordered = expectRow(committed.at(-1));
    expect(reordered.columns.map((c) => c.id)).toEqual(['c2', 'c1', 'c3']);
  });

  it.each([
    {
      removed: 'first',
      label: 'Remove column 1 of 3; its blocks move into the column on its right',
      focusLabel: 'Remove column 1 of 2; its blocks move into the column on its right',
      columnIds: ['c2', 'c3'],
      blockIds: [['a1', 'a2', 'b1'], ['g1']],
    },
    {
      removed: 'middle',
      label: 'Remove column 2 of 3; its blocks move into the column on its left',
      focusLabel: 'Remove column 1 of 2; its blocks move into the column on its right',
      columnIds: ['c1', 'c3'],
      blockIds: [['a1', 'a2', 'b1'], ['g1']],
    },
    {
      removed: 'last',
      label: 'Remove column 3 of 3; its blocks move into the column on its left',
      focusLabel: 'Remove column 2 of 2; its blocks move into the column on its left',
      columnIds: ['c1', 'c2'],
      blockIds: [
        ['a1', 'a2'],
        ['b1', 'g1'],
      ],
    },
  ])(
    'removes the $removed column, merges in document order and keeps focus in the row',
    async ({ label, focusLabel, columnIds, blockIds }) => {
      const committed: Block[] = [];
      await act(async () => {
        root.render(
          <RowHarness initial={THREE_COLUMN_ROW} onCommit={(next) => committed.push(next)} />
        );
      });

      const remove = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      expect(remove?.getAttribute('aria-label')).toBe(label);
      expect(remove?.title).toBe(label);
      expect(container.querySelector('button[aria-label="Remove column"]')).toBeNull();
      await act(async () => {
        remove?.focus();
        remove?.click();
        // The layout effect hands off before the interaction returns, not after paint.
        expect(document.activeElement).not.toBe(document.body);
      });

      const next = expectRow(committed.at(-1));
      expect(next.columns.map((column) => column.id)).toEqual(columnIds);
      expect(next.columns.map((column) => column.blocks.map((block) => block.id))).toEqual(
        blockIds
      );
      expect(container.querySelectorAll('[data-testid^="row-column-"]')).toHaveLength(2);

      const focused = container.querySelector<HTMLButtonElement>(
        `button[aria-label="${focusLabel}"]`
      );
      expect(focused).not.toBeNull();
      expect(document.activeElement).toBe(focused);
    }
  );

  it('moves focus to Add and explains the one-column floor', async () => {
    const row: Block = {
      id: 'r',
      type: 'row',
      columns: [
        { id: 'c1', blocks: [{ id: 'h', type: 'heading', level: 2, html: 'Agenda' }] },
        { id: 'c2', blocks: [{ id: 'p', type: 'paragraph', html: 'Doors at nine.' }] },
      ],
    };
    const committed: Block[] = [];

    await act(async () => {
      root.render(<RowHarness initial={row} onCommit={(next) => committed.push(next)} />);
    });

    const removeLabel = 'Remove column 2 of 2; its blocks move into the column on its left';
    const remove = container.querySelector<HTMLButtonElement>(
      `button[aria-label="${removeLabel}"]`
    );
    expect(remove?.getAttribute('aria-label')).toBe(removeLabel);
    expect(remove?.title).toBe(removeLabel);
    await act(async () => {
      remove?.focus();
      remove?.click();
      // The floor fallback is a layout effect too; body must never hold focus.
      expect(document.activeElement).not.toBe(document.body);
    });

    const next = expectRow(committed.at(-1));
    expect(next.columns).toHaveLength(1);
    expect(next.columns[0].blocks.map((block) => block.type)).toEqual(['heading', 'paragraph']);

    const add = container.querySelector<HTMLButtonElement>('button[aria-label="Add column"]');
    expect(add).not.toBeNull();
    expect(document.activeElement).toBe(add);

    const describedBy = add?.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    const hint = describedBy ? container.querySelector<HTMLElement>(`[id="${describedBy}"]`) : null;
    expect(hint?.textContent).toContain('A row needs at least one column');
    expect(hint?.closest('button')).toBeNull();

    const onlyRemove = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove column 1 of 1"]'
    );
    expect(onlyRemove?.disabled).toBe(true);
    await act(async () => {
      onlyRemove?.click();
    });
    expect(committed).toHaveLength(1);
    expect(document.activeElement).toBe(add);
  });

  it('does not spend a pending focus target on a later Add', async () => {
    const row: Block = {
      id: 'r',
      type: 'row',
      columns: [
        { id: 'c1', blocks: [] },
        { id: 'c2', blocks: [] },
      ],
    };
    await act(async () => {
      root.render(<RejectingRemovalHarness initial={row} />);
    });

    const remove = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove column 2 of 2; its blocks move into the column on its left"]'
    );
    await act(async () => {
      remove?.focus();
      remove?.click();
    });

    // The parent refused the removal, so the row did not shrink.
    expect(container.querySelectorAll('[data-testid^="row-column-"]')).toHaveLength(2);
    expect(document.activeElement).toBe(remove);

    const add = container.querySelector<HTMLButtonElement>('button[aria-label="Add column"]');
    await act(async () => {
      add?.focus();
      add?.click();
    });

    expect(container.querySelectorAll('[data-testid^="row-column-"]')).toHaveLength(3);
    // The refused removal's target must not steal focus from the later Add.
    expect(document.activeElement).toBe(add);
  });
});

const THREE_COLUMN_ROW: Block = {
  id: 'r',
  type: 'row',
  columns: [
    {
      id: 'c1',
      blocks: [
        { id: 'a1', type: 'paragraph', html: 'Alpha one' },
        { id: 'a2', type: 'paragraph', html: 'Alpha two' },
      ],
    },
    { id: 'c2', blocks: [{ id: 'b1', type: 'heading', level: 2, html: 'Beta' }] },
    { id: 'c3', blocks: [{ id: 'g1', type: 'paragraph', html: 'Gamma' }] },
  ],
};

/** Narrow the last committed draft, failing the test if it is not a row. */
function expectRow(block: Block | undefined): Extract<Block, { type: 'row' }> {
  if (block?.type !== 'row') throw new Error('expected a row');
  return block;
}

/** A controlled row, so a sequence of clicks is one row rather than a mock call. */
function RowHarness({ initial, onCommit }: { initial: Block; onCommit?: (next: Block) => void }) {
  const [row, setRow] = useState<Block>(initial);
  return (
    <BlockContentStudio
      currentBlock={row}
      setCurrentBlock={(next) => {
        setRow(next);
        onCommit?.(next);
      }}
    />
  );
}

/** A parent that refuses a removal, to prove a pending target cannot outlive it. */
function RejectingRemovalHarness({ initial }: { initial: Block }) {
  const [row, setRow] = useState<Block>(initial);
  return (
    <BlockContentStudio
      currentBlock={row}
      setCurrentBlock={(next) => {
        if (row.type === 'row' && next.type === 'row' && next.columns.length < row.columns.length) {
          return;
        }
        setRow(next);
      }}
    />
  );
}
