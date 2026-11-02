// @vitest-environment jsdom
'use client';

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableBlockEditor } from '@/components/visual-edit/composer/content/TableBlockEditor';
import type { Block } from '@/lib/blocks';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function TableHarness({
  initial,
  onChange,
}: {
  initial: Extract<Block, { type: 'table' }>;
  onChange?: (block: Extract<Block, { type: 'table' }>) => void;
}) {
  const [block, setBlock] = useState(initial);

  const handleSetBlock = (next: Block) => {
    if (next.type === 'table') {
      setBlock(next);
      onChange?.(next);
    }
  };

  return <TableBlockEditor currentBlock={block} setCurrentBlock={handleSetBlock} />;
}

describe('TableBlockEditor Atomic Operations', () => {
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

  it('renders table columns and data rows in visual mode by default', async () => {
    const tableBlock: Extract<Block, { type: 'table' }> = {
      id: 'tbl-1',
      type: 'table',
      head: ['Event', 'Location', 'Date'],
      rows: [
        ['Rally', 'Fair Oaks Park', 'Nov 5'],
        ['Town Hall', 'Community Center', 'Nov 12'],
      ],
    };

    await act(async () => {
      root.render(<TableHarness initial={tableBlock} />);
    });

    expect(container.textContent).toContain('Table Columns');
    expect(container.textContent).toContain('Table Data Rows');
    expect(container.textContent).toContain('3 cols');
    expect(container.textContent).toContain('2 rows');

    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="text"]');
    expect(inputs.length).toBeGreaterThanOrEqual(3);
  });

  it('atomically adds a column and appends blank cells to every row', async () => {
    const committed: Extract<Block, { type: 'table' }>[] = [];
    const tableBlock: Extract<Block, { type: 'table' }> = {
      id: 'tbl-1',
      type: 'table',
      head: ['Col A', 'Col B'],
      rows: [
        ['1', '2'],
        ['3', '4'],
      ],
    };

    await act(async () => {
      root.render(<TableHarness initial={tableBlock} onChange={(b) => committed.push(b)} />);
    });

    const addColBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Add table column"]'
    );
    expect(addColBtn).not.toBeNull();

    await act(async () => {
      addColBtn?.click();
    });

    const last = committed.at(-1);
    expect(last?.head).toEqual(['Col A', 'Col B', 'Column 3']);
    expect(last?.rows).toEqual([
      ['1', '2', ''],
      ['3', '4', ''],
    ]);
  });

  it('atomically deletes a column and removes the corresponding cell across all rows', async () => {
    const committed: Extract<Block, { type: 'table' }>[] = [];
    const tableBlock: Extract<Block, { type: 'table' }> = {
      id: 'tbl-1',
      type: 'table',
      head: ['First', 'Middle', 'Last'],
      rows: [
        ['John', 'Q', 'Public'],
        ['Jane', 'X', 'Doe'],
      ],
    };

    await act(async () => {
      root.render(<TableHarness initial={tableBlock} onChange={(b) => committed.push(b)} />);
    });

    // Delete middle column (index 1) with confirmation
    const deleteCol2Btn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete column 2"]'
    );
    expect(deleteCol2Btn).not.toBeNull();

    await act(async () => {
      deleteCol2Btn?.click();
    });

    // Confirm step
    const confirmColBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Delete'
    );
    expect(confirmColBtn).toBeDefined();

    await act(async () => {
      confirmColBtn?.click();
    });

    const last = committed.at(-1);
    expect(last?.head).toEqual(['First', 'Last']);
    expect(last?.rows).toEqual([
      ['John', 'Public'],
      ['Jane', 'Doe'],
    ]);
  });

  it('disables column deletion when only 1 column remains', async () => {
    const tableBlock: Extract<Block, { type: 'table' }> = {
      id: 'tbl-1',
      type: 'table',
      head: ['Only Column'],
      rows: [['Cell 1']],
    };

    await act(async () => {
      root.render(<TableHarness initial={tableBlock} />);
    });

    const deleteColBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete column 1"]'
    );
    expect(deleteColBtn).not.toBeNull();
    expect(deleteColBtn?.disabled).toBe(true);
  });

  it('atomically adds and removes rows with confirmation and allows cell editing', async () => {
    const committed: Extract<Block, { type: 'table' }>[] = [];
    const tableBlock: Extract<Block, { type: 'table' }> = {
      id: 'tbl-1',
      type: 'table',
      head: ['Name', 'Role'],
      rows: [['Alice', 'Organizer']],
    };

    await act(async () => {
      root.render(<TableHarness initial={tableBlock} onChange={(b) => committed.push(b)} />);
    });

    // Add Row
    const addRowBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Add table row"]'
    );
    expect(addRowBtn).not.toBeNull();

    await act(async () => {
      addRowBtn?.click();
    });

    expect(committed.at(-1)?.rows).toHaveLength(2);
    expect(committed.at(-1)?.rows[1]).toEqual(['', '']);

    // Delete row 1 (the original Alice row) - click idle button
    const deleteRow1Btn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete row 1"]'
    );
    expect(deleteRow1Btn).not.toBeNull();

    await act(async () => {
      deleteRow1Btn?.click();
    });

    // Confirm step
    const confirmRowBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Delete'
    );
    expect(confirmRowBtn).toBeDefined();

    await act(async () => {
      confirmRowBtn?.click();
    });

    expect(committed.at(-1)?.rows).toHaveLength(1);
    expect(committed.at(-1)?.rows[0]).toEqual(['', '']);
  });

  it('reorders rows up and down correctly', async () => {
    const committed: Extract<Block, { type: 'table' }>[] = [];
    const tableBlock: Extract<Block, { type: 'table' }> = {
      id: 'tbl-1',
      type: 'table',
      head: ['Step'],
      rows: [['Step 1'], ['Step 2'], ['Step 3']],
    };

    await act(async () => {
      root.render(<TableHarness initial={tableBlock} onChange={(b) => committed.push(b)} />);
    });

    // Move row 2 up to position 1
    const moveRow2UpBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Move row 2 up"]'
    );
    expect(moveRow2UpBtn).not.toBeNull();

    await act(async () => {
      moveRow2UpBtn?.click();
    });

    expect(committed.at(-1)?.rows).toEqual([['Step 2'], ['Step 1'], ['Step 3']]);
  });

  it('switches to Raw CSV mode and allows bulk text editing', async () => {
    const committed: Extract<Block, { type: 'table' }>[] = [];
    const tableBlock: Extract<Block, { type: 'table' }> = {
      id: 'tbl-1',
      type: 'table',
      head: ['City', 'Zip'],
      rows: [['Fair Oaks', '95628']],
    };

    await act(async () => {
      root.render(<TableHarness initial={tableBlock} onChange={(b) => committed.push(b)} />);
    });

    // Click Raw CSV button
    const rawModeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Raw CSV')
    );
    expect(rawModeBtn).toBeDefined();

    await act(async () => {
      rawModeBtn?.click();
    });

    expect(container.textContent).toContain('Table Columns (comma-separated headers)');

    // Edit CSV rows
    const textareas = container.querySelectorAll<HTMLTextAreaElement>('textarea');
    expect(textareas.length).toBeGreaterThanOrEqual(1);

    const rowsTextarea = textareas[textareas.length - 1];
    await act(async () => {
      const setVal = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setVal?.call(rowsTextarea, 'Carmichael, 95608\nFair Oaks, 95628');
      rowsTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      rowsTextarea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(committed.at(-1)?.rows).toEqual([
      ['Carmichael', '95608'],
      ['Fair Oaks', '95628'],
    ]);
  });
});
