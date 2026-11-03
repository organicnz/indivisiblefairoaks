// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type ModifiedBlockItem,
  type ModifiedDataPointItem,
  VisualDiffModal,
} from '@/components/visual-edit/VisualDiffModal';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('VisualDiffModal', () => {
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

  it('renders empty state when no changes exist', async () => {
    await act(async () => {
      root.render(
        <VisualDiffModal
          open={true}
          onOpenChange={vi.fn()}
          modifiedDataPoints={[]}
          modifiedBlocks={[]}
        />
      );
    });

    expect(document.body.textContent).toContain('No Unsaved Changes');
  });

  it('renders modified DataPoints and allows reverting', async () => {
    const handleRevert = vi.fn();
    const handleSaveAll = vi.fn();

    const mockDataPoints: ModifiedDataPointItem[] = [
      {
        key: 'home.hero.title',
        initialValue: 'Original Headline',
        currentValue: 'New Inspiring Headline',
      },
    ];

    const mockBlocks: ModifiedBlockItem[] = [
      {
        blockId: 'block-1',
        type: 'heading',
        label: 'Hero Section',
      },
    ];

    await act(async () => {
      root.render(
        <VisualDiffModal
          open={true}
          onOpenChange={vi.fn()}
          modifiedDataPoints={mockDataPoints}
          modifiedBlocks={mockBlocks}
          onRevertDataPoint={handleRevert}
          onSaveAll={handleSaveAll}
        />
      );
    });

    expect(document.body.textContent).toContain('home.hero.title');
    expect(document.body.textContent).toContain('Original Headline');
    expect(document.body.textContent).toContain('New Inspiring Headline');
    expect(document.body.textContent).toContain('Hero Section');

    // Click Revert
    const revertBtn = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="diff-datapoint-home.hero.title"] button'
    );
    expect(revertBtn).not.toBeNull();
    await act(async () => {
      revertBtn?.click();
    });
    expect(handleRevert).toHaveBeenCalledWith('home.hero.title');

    // Click Save All
    const saveBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save & Publish All')
    );
    expect(saveBtn).not.toBeNull();
    await act(async () => {
      saveBtn?.click();
    });
    expect(handleSaveAll).toHaveBeenCalled();
  });

  it('filters between DataPoints and Page Blocks tabs', async () => {
    const mockDataPoints: ModifiedDataPointItem[] = [
      { key: 'section.title', initialValue: 'Before', currentValue: 'After' },
    ];
    const mockBlocks: ModifiedBlockItem[] = [
      { blockId: 'b-1', type: 'callout', label: 'Callout Alert' },
    ];

    await act(async () => {
      root.render(
        <VisualDiffModal
          open={true}
          onOpenChange={vi.fn()}
          modifiedDataPoints={mockDataPoints}
          modifiedBlocks={mockBlocks}
        />
      );
    });

    expect(document.body.textContent).toContain('section.title');
    expect(document.body.textContent).toContain('Callout Alert');

    // Filter to DataPoints only
    const dataPointsTab = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('DataPoints')
    );
    await act(async () => {
      dataPointsTab?.click();
    });
    expect(document.body.textContent).toContain('section.title');
    expect(document.body.textContent).not.toContain('Callout Alert');

    // Filter to Page Blocks only
    const blocksTab = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Page Blocks')
    );
    await act(async () => {
      blocksTab?.click();
    });
    expect(document.body.textContent).not.toContain('section.title');
    expect(document.body.textContent).toContain('Callout Alert');

    // Return to All Changes
    const allTab = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('All Changes')
    );
    await act(async () => {
      allTab?.click();
    });
    expect(document.body.textContent).toContain('section.title');
    expect(document.body.textContent).toContain('Callout Alert');
  });

  it('handles empty value fallbacks and close actions', async () => {
    const handleOpenChange = vi.fn();
    const mockDataPoints: ModifiedDataPointItem[] = [
      { key: 'empty.key', initialValue: '', currentValue: '' },
    ];

    await act(async () => {
      root.render(
        <VisualDiffModal
          open={true}
          onOpenChange={handleOpenChange}
          modifiedDataPoints={mockDataPoints}
        />
      );
    });

    // Renders (empty) fallback text
    expect(document.body.textContent).toContain('(empty)');

    // Click header close button
    const closeBtn = document.body.querySelector<HTMLButtonElement>('button[aria-label="Close diff modal"]');
    expect(closeBtn).not.toBeNull();
    await act(async () => {
      closeBtn?.click();
    });
    expect(handleOpenChange).toHaveBeenCalledWith(false);

    // Click footer close button
    const footerCloseBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Close'
    );
    expect(footerCloseBtn).not.toBeNull();
    await act(async () => {
      footerCloseBtn?.click();
    });
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders saving state when isSaving is true', async () => {
    const mockDataPoints: ModifiedDataPointItem[] = [
      { key: 'key.1', initialValue: 'A', currentValue: 'B' },
    ];

    await act(async () => {
      root.render(
        <VisualDiffModal
          open={true}
          onOpenChange={vi.fn()}
          modifiedDataPoints={mockDataPoints}
          onSaveAll={vi.fn()}
          isSaving={true}
        />
      );
    });

    const saveBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Saving…')
    );
    expect(saveBtn).not.toBeNull();
    expect(saveBtn?.disabled).toBe(true);
  });
});
