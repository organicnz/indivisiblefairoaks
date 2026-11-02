// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RowBlockEditor } from '@/components/visual-edit/composer/content/RowBlockEditor';
import type { RowBlock } from '@/lib/blocks';

describe('RowBlockEditor', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const sampleRow: RowBlock = {
    id: 'row-1',
    type: 'row',
    columns: [
      {
        id: 'col-1',
        blocks: [{ id: 'p-1', type: 'paragraph', html: '<p>Left Column Text</p>' }],
      },
      {
        id: 'col-2',
        blocks: [{ id: 'p-2', type: 'paragraph', html: '<p>Right Column Text</p>' }],
      },
    ],
  };

  it('renders columns and child blocks', async () => {
    await act(async () => {
      root.render(
        <RowBlockEditor
          currentBlock={sampleRow}
          setCurrentBlock={vi.fn()}
          onAddColumn={vi.fn()}
          onRemoveColumn={vi.fn()}
          onAddBlock={vi.fn()}
          onReorderBlock={vi.fn()}
          onRemoveBlock={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain('Column 1');
    expect(container.textContent).toContain('Column 2');
    expect(container.textContent).toContain('Left Column Text');
    expect(container.textContent).toContain('Right Column Text');
  });

  it('calls onRemoveColumn when remove column button is clicked', async () => {
    const onRemoveColumn = vi.fn();

    await act(async () => {
      root.render(
        <RowBlockEditor
          currentBlock={sampleRow}
          setCurrentBlock={vi.fn()}
          onAddColumn={vi.fn()}
          onRemoveColumn={onRemoveColumn}
          onAddBlock={vi.fn()}
          onReorderBlock={vi.fn()}
          onRemoveBlock={vi.fn()}
        />
      );
    });

    const removeCol1Btn = container.querySelector<HTMLButtonElement>(
      'button[aria-label^="Remove column 1"]'
    );
    expect(removeCol1Btn).not.toBeNull();

    await act(async () => {
      removeCol1Btn?.click();
    });

    expect(onRemoveColumn).toHaveBeenCalledWith(0);
  });

  it('requires confirmation before deleting a child block inside a column', async () => {
    const onRemoveBlock = vi.fn();

    await act(async () => {
      root.render(
        <RowBlockEditor
          currentBlock={sampleRow}
          setCurrentBlock={vi.fn()}
          onAddColumn={vi.fn()}
          onRemoveColumn={vi.fn()}
          onAddBlock={vi.fn()}
          onReorderBlock={vi.fn()}
          onRemoveBlock={onRemoveBlock}
        />
      );
    });

    const deleteBlockBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete Left Column Text"]'
    );
    expect(deleteBlockBtn).not.toBeNull();

    // Click delete block to enter confirmation mode
    await act(async () => {
      deleteBlockBtn?.click();
    });

    expect(container.textContent).toContain('Delete Left Column Text?');
    expect(onRemoveBlock).not.toHaveBeenCalled();

    // Click confirm Delete
    const confirmBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent === 'Delete'
    );
    expect(confirmBtn).toBeDefined();

    await act(async () => {
      confirmBtn?.click();
    });

    expect(onRemoveBlock).toHaveBeenCalledWith('p-1');
  });
});
