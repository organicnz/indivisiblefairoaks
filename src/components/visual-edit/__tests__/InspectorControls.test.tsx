// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectorFooter, InspectorTabBar } from '@/components/visual-edit/composer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('InspectorTabBar and InspectorFooter', () => {
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

  it('renders all inspector tabs and triggers setActiveTab', async () => {
    const setActiveTab = vi.fn();

    await act(async () => {
      root.render(<InspectorTabBar activeTab="content" setActiveTab={setActiveTab} />);
    });

    expect(container.textContent).toContain('Content');
    expect(container.textContent).toContain('Presets');
    expect(container.textContent).toContain('Box Model');
    expect(container.textContent).toContain('Type');
    expect(container.textContent).toContain('Code');
    expect(container.textContent).toContain('Advanced');

    // Click Box Model tab
    const designTab = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Box Model')
    );
    expect(designTab).toBeDefined();

    await act(async () => {
      designTab?.click();
    });

    expect(setActiveTab).toHaveBeenCalledWith('design');
  });

  it('renders InspectorFooter in block mode and section mode', async () => {
    const onResetStyles = vi.fn();
    const onClose = vi.fn();
    const onApply = vi.fn();

    // Block mode
    await act(async () => {
      root.render(
        <InspectorFooter
          inspectorMode="block"
          onResetStyles={onResetStyles}
          onClose={onClose}
          onApply={onApply}
        />
      );
    });

    expect(container.textContent).toContain('Reset Styles');
    expect(container.textContent).toContain('Cancel');
    expect(container.textContent).toContain('Save Block');

    const resetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reset Styles')
    );
    await act(async () => {
      resetBtn?.click();
    });
    expect(onResetStyles).toHaveBeenCalledTimes(1);

    const cancelBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cancel')
    );
    await act(async () => {
      cancelBtn?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    const saveBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save Block')
    );
    await act(async () => {
      saveBtn?.click();
    });
    expect(onApply).toHaveBeenCalledTimes(1);

    // Section mode
    await act(async () => {
      root.render(
        <InspectorFooter
          inspectorMode="section"
          onResetStyles={onResetStyles}
          onClose={onClose}
          onApply={onApply}
        />
      );
    });

    expect(container.textContent).toContain('Save Section');
  });
});
