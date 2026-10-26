// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageNavigatorDrawer } from '@/components/visual-edit/PageNavigatorDrawer';
import type { Block } from '@/lib/blocks';
import type { VisualSection } from '@/lib/visual-sections';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('PageNavigatorDrawer', () => {
  let container: HTMLDivElement;
  let root: Root;

  const sampleBlocks: Block[] = [
    { id: 'b1', type: 'heading', level: 2, html: 'Grassroots Community Action' },
    { id: 'b2', type: 'paragraph', html: 'We organize peaceful rallies.' },
    { id: 'b3', type: 'button', label: 'Join Action', href: '/donate' },
  ];

  const sampleSections: VisualSection[] = [
    {
      key: 'sec-0',
      blockIndex: 0,
      domIndex: 0,
      label: 'Grassroots Community Action',
      blockType: 'heading',
      ordinal: 1,
    },
    {
      key: 'sec-1',
      blockIndex: 1,
      domIndex: 1,
      label: 'We organize peaceful rallies.',
      blockType: 'paragraph',
      ordinal: 2,
    },
    {
      key: 'sec-2',
      blockIndex: 2,
      domIndex: 2,
      label: 'Join Action',
      blockType: 'button',
      ordinal: 3,
    },
  ];

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

  it('renders nothing when open is false', async () => {
    await act(async () => {
      root.render(
        <PageNavigatorDrawer
          open={false}
          onClose={vi.fn()}
          sections={sampleSections}
          blocks={sampleBlocks}
          activeBlockIndex={0}
          onSelectBlock={vi.fn()}
          onMoveBlock={vi.fn()}
          onDuplicateBlock={vi.fn()}
          onDeleteBlock={vi.fn()}
          onOpenComposer={vi.fn()}
          onOpenLibrary={vi.fn()}
        />
      );
    });

    expect(document.body.textContent).not.toContain('Structure Navigator');
  });

  it('renders structure list and allows searching/filtering', async () => {
    await act(async () => {
      root.render(
        <PageNavigatorDrawer
          open={true}
          onClose={vi.fn()}
          sections={sampleSections}
          blocks={sampleBlocks}
          activeBlockIndex={0}
          onSelectBlock={vi.fn()}
          onMoveBlock={vi.fn()}
          onDuplicateBlock={vi.fn()}
          onDeleteBlock={vi.fn()}
          onOpenComposer={vi.fn()}
          onOpenLibrary={vi.fn()}
        />
      );
    });

    expect(document.body.textContent).toContain('Structure Navigator');
    expect(document.body.textContent).toContain('3 blocks on page');
    expect(document.body.textContent).toContain('Grassroots Community Action');
    expect(document.body.textContent).toContain('We organize peaceful rallies.');
    expect(document.body.textContent).toContain('Join Action');

    const searchInput = document.querySelector<HTMLInputElement>('input');
    expect(searchInput).not.toBeNull();
    if (searchInput) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) {
          setter.call(searchInput, 'rallies');
        }
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    expect(document.body.textContent).toContain('We organize peaceful rallies.');
    expect(document.body.textContent).not.toContain('Join Action');
  });

  it('handles item selection and reordering callbacks', async () => {
    const onSelectBlock = vi.fn();
    const onMoveBlock = vi.fn();
    const onDuplicateBlock = vi.fn();
    const onDeleteBlock = vi.fn();
    const onOpenComposer = vi.fn();

    await act(async () => {
      root.render(
        <PageNavigatorDrawer
          open={true}
          onClose={vi.fn()}
          sections={sampleSections}
          blocks={sampleBlocks}
          activeBlockIndex={1}
          onSelectBlock={onSelectBlock}
          onMoveBlock={onMoveBlock}
          onDuplicateBlock={onDuplicateBlock}
          onDeleteBlock={onDeleteBlock}
          onOpenComposer={onOpenComposer}
          onOpenLibrary={vi.fn()}
        />
      );
    });

    // Click item row to select
    const headingButton = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Grassroots Community Action')
    );
    expect(headingButton).toBeDefined();
    await act(async () => {
      headingButton?.click();
    });
    expect(onSelectBlock).toHaveBeenCalledWith(0);

    // Click move down button
    const moveDownButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Move block #1 down"]'
    );
    expect(moveDownButton).not.toBeNull();
    await act(async () => {
      moveDownButton?.click();
    });
    expect(onMoveBlock).toHaveBeenCalledWith(0, 'down');

    // Click composer button
    const composerButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Customize block #1 in Visual Composer"]'
    );
    expect(composerButton).not.toBeNull();
    await act(async () => {
      composerButton?.click();
    });
    expect(onOpenComposer).toHaveBeenCalledWith(0);

    // Click duplicate button
    const duplicateButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Duplicate block #1"]'
    );
    expect(duplicateButton).not.toBeNull();
    await act(async () => {
      duplicateButton?.click();
    });
    expect(onDuplicateBlock).toHaveBeenCalledWith(0);

    // Click delete button
    const deleteButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete block #1"]'
    );
    expect(deleteButton).not.toBeNull();
    await act(async () => {
      deleteButton?.click();
    });
    expect(onDeleteBlock).toHaveBeenCalledWith(0);
  });
});
