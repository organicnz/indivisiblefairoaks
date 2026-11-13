// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VisualComposerCanvas } from '../VisualComposerCanvas';
import type { ComposerBlock } from '../types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/lib/actions/crm', () => ({
  uploadCRMMedia: vi.fn().mockResolvedValue({
    success: true,
    data: { name: 'rally.jpg', url: 'https://storage/crm/rally.jpg' },
  }),
  getCRMMediaLibrary: vi.fn().mockResolvedValue({
    success: true,
    data: [],
  }),
}));

describe('VisualComposerCanvas', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  const renderComponent = async (blocks: ComposerBlock[], onChange: (b: ComposerBlock[]) => void) => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<VisualComposerCanvas blocks={blocks} onChange={onChange} />);
    });
    return {
      root,
      container,
      unmount: async () => {
        await act(async () => {
          root.unmount();
        });
        container.remove();
      },
    };
  };

  it('renders all blocks and enables adding new blocks of different types', async () => {
    const initialBlocks: ComposerBlock[] = [
      { id: 'b_1', type: 'header', heading: 'Main Title', level: 1 },
      { id: 'b_2', type: 'text', content: 'Story text' },
    ];
    let currentBlocks = [...initialBlocks];
    const onChange = vi.fn((next) => {
      currentBlocks = next;
    });

    const { unmount } = await renderComponent(currentBlocks, onChange);

    // Look for Add Section Block buttons
    const addHeadlineBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Headline')
    );
    expect(addHeadlineBtn).toBeDefined();

    await act(async () => {
      addHeadlineBtn?.click();
    });

    expect(onChange).toHaveBeenCalled();
    expect(currentBlocks.length).toBe(3);
    expect(currentBlocks[2].type).toBe('header');

    await unmount();
  });

  it('supports moving blocks up and down', async () => {
    const initialBlocks: ComposerBlock[] = [
      { id: 'b_1', type: 'header', heading: 'First', level: 1 },
      { id: 'b_2', type: 'text', content: 'Second' },
    ];
    let currentBlocks = [...initialBlocks];
    const onChange = vi.fn((next) => {
      currentBlocks = next;
    });

    const { unmount } = await renderComponent(currentBlocks, onChange);

    // Click Move Down on block 1
    const moveDownBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Move block 1 down"]'
    );
    expect(moveDownBtn).not.toBeNull();

    await act(async () => {
      moveDownBtn?.click();
    });

    expect(onChange).toHaveBeenCalled();
    expect(currentBlocks[0].id).toBe('b_2');
    expect(currentBlocks[1].id).toBe('b_1');

    await unmount();
  });

  it('duplicates a block when clicking duplicate', async () => {
    const initialBlocks: ComposerBlock[] = [
      { id: 'b_1', type: 'quote', quote: 'Inspiring Words', author: 'Organizer' },
    ];
    let currentBlocks = [...initialBlocks];
    const onChange = vi.fn((next) => {
      currentBlocks = next;
    });

    const { unmount } = await renderComponent(currentBlocks, onChange);

    const duplicateBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Duplicate block 1"]'
    );
    expect(duplicateBtn).not.toBeNull();

    await act(async () => {
      duplicateBtn?.click();
    });

    expect(onChange).toHaveBeenCalled();
    expect(currentBlocks.length).toBe(2);
    expect(currentBlocks[1].type).toBe('quote');
    expect((currentBlocks[1] as { quote?: string }).quote).toBe('Inspiring Words');
    expect(currentBlocks[1].id).not.toBe('b_1');

    await unmount();
  });

  it('morphs compatible text blocks (e.g. text to header)', async () => {
    const initialBlocks: ComposerBlock[] = [
      { id: 'b_1', type: 'text', content: 'Transform me into a headline' },
    ];
    let currentBlocks = [...initialBlocks];
    const onChange = vi.fn((next) => {
      currentBlocks = next;
    });

    const { unmount } = await renderComponent(currentBlocks, onChange);

    const morphSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Convert block 1 type"]'
    );
    expect(morphSelect).not.toBeNull();

    await act(async () => {
      if (morphSelect) {
        morphSelect.value = 'header';
        morphSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(onChange).toHaveBeenCalled();
    expect(currentBlocks[0].type).toBe('header');
    expect((currentBlocks[0] as { heading?: string }).heading).toBe('Transform me into a headline');

    await unmount();
  });

  it('removes a block and displays toast with undo action', async () => {
    const initialBlocks: ComposerBlock[] = [
      { id: 'b_1', type: 'header', heading: 'Title', level: 1 },
      { id: 'b_2', type: 'text', content: 'Delete me' },
    ];
    let currentBlocks = [...initialBlocks];
    const onChange = vi.fn((next) => {
      currentBlocks = next;
    });

    const { unmount } = await renderComponent(currentBlocks, onChange);

    const deleteBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete block 2"]'
    );
    expect(deleteBtn).not.toBeNull();

    await act(async () => {
      deleteBtn?.click();
    });

    expect(onChange).toHaveBeenCalled();
    expect(currentBlocks.length).toBe(1);
    expect(currentBlocks[0].id).toBe('b_1');
    expect(toast).toHaveBeenCalledWith('text block removed', expect.objectContaining({ action: expect.any(Object) }));

    await unmount();
  });

  it('resets to empty text block when deleting the last remaining block', async () => {
    const initialBlocks: ComposerBlock[] = [
      { id: 'b_only', type: 'callout', title: 'Solo', text: 'Lone block' },
    ];
    let currentBlocks = [...initialBlocks];
    const onChange = vi.fn((next) => {
      currentBlocks = next;
    });

    const { unmount } = await renderComponent(currentBlocks, onChange);

    const deleteBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete block 1"]'
    );
    expect(deleteBtn).not.toBeNull();

    await act(async () => {
      deleteBtn?.click();
    });

    expect(onChange).toHaveBeenCalled();
    expect(currentBlocks.length).toBe(1);
    expect(currentBlocks[0].type).toBe('text');
    expect((currentBlocks[0] as { content?: string }).content).toBe('');

    await unmount();
  });

  it('opens merge tag dropdown, inserts token, and closes on Escape', async () => {
    const initialBlocks: ComposerBlock[] = [
      { id: 'b_1', type: 'text', content: 'Hello' },
    ];
    let currentBlocks = [...initialBlocks];
    const onChange = vi.fn((next) => {
      currentBlocks = next;
    });

    const { unmount } = await renderComponent(currentBlocks, onChange);

    const tagBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Insert personalization merge tag"]'
    );
    expect(tagBtn).not.toBeNull();

    // Click to open tag menu
    await act(async () => {
      tagBtn?.click();
    });

    expect(container.querySelector('[data-testid="merge-tag-menu"]')).not.toBeNull();

    // Select First Name token
    const firstNameItem = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[data-testid="merge-tag-menu"] button')
    ).find((b) => b.textContent?.includes('First Name'));
    expect(firstNameItem).toBeDefined();

    await act(async () => {
      firstNameItem?.click();
    });

    expect(onChange).toHaveBeenCalled();
    expect((currentBlocks[0] as { content?: string }).content).toContain('{{first_name}}');
    expect(container.querySelector('[data-testid="merge-tag-menu"]')).toBeNull();

    // Open again and verify Escape closes it
    await act(async () => {
      tagBtn?.click();
    });
    expect(container.querySelector('[data-testid="merge-tag-menu"]')).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(container.querySelector('[data-testid="merge-tag-menu"]')).toBeNull();
    expect(document.activeElement).toBe(tagBtn);

    await unmount();
  });

  it('supports Undo and Redo via toolbar and keyboard shortcuts', async () => {
    const initialBlocks: ComposerBlock[] = [
      { id: 'b_1', type: 'text', content: 'Initial text' },
    ];
    const onChange = vi.fn();

    const { unmount } = await renderComponent(initialBlocks, onChange);

    const undoBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Undo block edit"]');
    const redoBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Redo block edit"]');

    expect(undoBtn?.disabled).toBe(true);
    expect(redoBtn?.disabled).toBe(true);

    // Add a block to push history
    const addBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('CTA Button')
    );
    await act(async () => {
      addBtn?.click();
    });

    expect(undoBtn?.disabled).toBe(false);

    // Click undo
    await act(async () => {
      undoBtn?.click();
    });

    expect(redoBtn?.disabled).toBe(false);

    // Press Cmd+Shift+Z for redo
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true }));
    });

    expect(undoBtn?.disabled).toBe(false);

    await unmount();
  });

  it('toggles live visual preview and collapsed view per block and globally', async () => {
    const initialBlocks: ComposerBlock[] = [
      { id: 'b_1', type: 'header', heading: 'H1 Title', level: 1 },
      { id: 'b_2', type: 'text', content: 'Story' },
    ];
    const onChange = vi.fn();

    const { unmount } = await renderComponent(initialBlocks, onChange);

    // Toggle live preview for block 1
    const togglePreviewBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle preview for block 1"]'
    );
    expect(togglePreviewBtn).not.toBeNull();

    await act(async () => {
      togglePreviewBtn?.click();
    });

    // Check that H1 title preview is rendered
    expect(container.querySelector('h1')?.textContent).toBe('H1 Title');

    // Collapse block 1
    const collapseBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Collapse block 1"]'
    );
    await act(async () => {
      collapseBtn?.click();
    });

    // When collapsed, content inside is hidden
    expect(container.querySelector('h1')).toBeNull();

    await unmount();
  });
});
