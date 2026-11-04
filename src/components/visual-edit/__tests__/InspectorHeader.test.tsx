// @vitest-environment jsdom-same-realm
'use client';

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectorHeader } from '@/components/visual-edit/composer/InspectorHeader';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('InspectorHeader Atomic Actions', () => {
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

  it('renders block ordinal, type and label, and triggers delete on confirmation', async () => {
    const onDeleteBlock = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <InspectorHeader
          titleId="test-title"
          descId="test-desc"
          blockIndex={2}
          blockType="paragraph"
          blockLabel="Join us tomorrow at Fair Oaks Park"
          inspectorMode="block"
          setInspectorMode={vi.fn()}
          hasCopiedStyles={false}
          onCopyStyles={vi.fn()}
          onPasteStyles={vi.fn()}
          onResetStyles={vi.fn()}
          onClose={onClose}
          onDeleteBlock={onDeleteBlock}
        />
      );
    });

    expect(container.textContent).toContain('Block #3 · paragraph');
    expect(container.textContent).toContain('Join us tomorrow at Fair Oaks Park');

    // Idle delete button
    const deleteBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete block #3"]'
    );
    expect(deleteBtn).not.toBeNull();
    expect(deleteBtn?.textContent).toContain('Delete');

    // Click Delete -> should open inline confirmation
    await act(async () => {
      deleteBtn?.click();
    });

    expect(container.textContent).toContain('Delete #3 (paragraph)?');
    const confirmBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Delete'
    );
    expect(confirmBtn).toBeDefined();

    // Confirm deletion
    await act(async () => {
      confirmBtn?.click();
    });

    expect(onDeleteBlock).toHaveBeenCalledTimes(1);
  });

  it('cancels deletion when Cancel button is clicked', async () => {
    const onDeleteBlock = vi.fn();

    await act(async () => {
      root.render(
        <InspectorHeader
          titleId="test-title"
          descId="test-desc"
          blockIndex={0}
          blockType="heading"
          inspectorMode="block"
          setInspectorMode={vi.fn()}
          hasCopiedStyles={false}
          onCopyStyles={vi.fn()}
          onPasteStyles={vi.fn()}
          onResetStyles={vi.fn()}
          onClose={vi.fn()}
          onDeleteBlock={onDeleteBlock}
        />
      );
    });

    const deleteBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete block #1"]'
    );
    await act(async () => {
      deleteBtn?.click();
    });

    const cancelBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Cancel'
    );
    expect(cancelBtn).toBeDefined();

    await act(async () => {
      cancelBtn?.click();
    });

    expect(onDeleteBlock).not.toHaveBeenCalled();
    // Returns to idle button
    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="Delete block #1"]')
    ).not.toBeNull();
  });

  it('renders batch mode headers and allows batch deletion', async () => {
    const onDeleteBlock = vi.fn();

    await act(async () => {
      root.render(
        <InspectorHeader
          titleId="test-title"
          descId="test-desc"
          blockIndex={0}
          blockType="paragraph"
          isBatchMode
          selectedCount={4}
          inspectorMode="block"
          setInspectorMode={vi.fn()}
          hasCopiedStyles={false}
          onCopyStyles={vi.fn()}
          onPasteStyles={vi.fn()}
          onResetStyles={vi.fn()}
          onClose={vi.fn()}
          onDeleteBlock={onDeleteBlock}
        />
      );
    });

    expect(container.textContent).toContain('4 blocks · batch styling');

    const deleteBatchBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete 4 selected blocks"]'
    );
    expect(deleteBatchBtn).not.toBeNull();
    expect(deleteBatchBtn?.textContent).toContain('Delete (4)');

    await act(async () => {
      deleteBatchBtn?.click();
    });

    expect(container.textContent).toContain('Delete 4 blocks?');

    const confirmBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Delete'
    );
    await act(async () => {
      confirmBtn?.click();
    });

    expect(onDeleteBlock).toHaveBeenCalledTimes(1);
  });

  it('renders reorder controls and invokes onMoveBlock callback', async () => {
    const onMoveBlock = vi.fn();

    await act(async () => {
      root.render(
        <InspectorHeader
          titleId="test-title"
          descId="test-desc"
          blockIndex={1}
          blockType="paragraph"
          inspectorMode="block"
          setInspectorMode={vi.fn()}
          hasCopiedStyles={false}
          onCopyStyles={vi.fn()}
          onPasteStyles={vi.fn()}
          onResetStyles={vi.fn()}
          onClose={vi.fn()}
          onMoveBlock={onMoveBlock}
          canMoveUp={true}
          canMoveDown={true}
        />
      );
    });

    const moveUpBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Move block up in page order"]'
    );
    const moveDownBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Move block down in page order"]'
    );

    expect(moveUpBtn).not.toBeNull();
    expect(moveDownBtn).not.toBeNull();
    expect(moveUpBtn?.disabled).toBe(false);
    expect(moveDownBtn?.disabled).toBe(false);

    await act(async () => {
      moveUpBtn?.click();
    });
    expect(onMoveBlock).toHaveBeenCalledWith('up');

    await act(async () => {
      moveDownBtn?.click();
    });
    expect(onMoveBlock).toHaveBeenCalledWith('down');
  });
});
