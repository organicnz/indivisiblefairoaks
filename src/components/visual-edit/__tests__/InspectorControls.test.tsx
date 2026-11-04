// @vitest-environment jsdom-same-realm
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
      root.render(
        <InspectorTabBar activeTab="content" setActiveTab={setActiveTab} idBase="tabs" />
      );
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

    expect(container.textContent).toContain('Reset Design');
    expect(container.textContent).toContain('Cancel');
    expect(container.textContent).toContain('Save Block');

    const resetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reset Design')
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

  it('omits tabs that do not apply to the current mode', async () => {
    await act(async () => {
      root.render(
        <InspectorTabBar
          activeTab="presets"
          setActiveTab={vi.fn()}
          excludedTabs={['content', 'code']}
          idBase="tabs"
        />
      );
    });

    const labels = Array.from(container.querySelectorAll('button')).map((b) =>
      b.textContent?.trim()
    );
    expect(labels).not.toContain('Content');
    expect(labels).not.toContain('Code');
    expect(labels).toContain('Presets');
    expect(labels).toContain('Box Model');
    expect(labels).toContain('Type');
    expect(labels).toContain('Advanced');
  });

  it('is a real tablist: one tab stop, arrows and Home/End move the selection', async () => {
    const setActiveTab = vi.fn();

    await act(async () => {
      root.render(
        <InspectorTabBar activeTab="content" setActiveTab={setActiveTab} idBase="tabs" />
      );
    });

    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();

    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs).toHaveLength(6);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
      'false',
      'false',
      'false',
    ]);

    // Six tabs are one stop in the Tab order, not six: only the active one is
    // reachable, and the arrow keys are how the rest are reached.
    expect(tabs.map((tab) => tab.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
      '-1',
      '-1',
      '-1',
    ]);

    // Every tab points at the panel that shares its id prefix.
    expect(tabs[0].id).toBe('tabs-tab-content');
    expect(tabs[0].getAttribute('aria-controls')).toBe('tabs-panel-content');

    const press = async (key: string) => {
      await act(async () => {
        tablist?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      });
    };

    await press('ArrowRight');
    expect(setActiveTab).toHaveBeenLastCalledWith('presets');

    await press('End');
    expect(setActiveTab).toHaveBeenLastCalledWith('advanced');

    await press('Home');
    expect(setActiveTab).toHaveBeenLastCalledWith('content');

    // ArrowLeft from the first tab wraps to the last, like every other strip.
    await press('ArrowLeft');
    expect(setActiveTab).toHaveBeenLastCalledWith('advanced');
  });

  it('disables Apply when there is nothing to write, and says why', async () => {
    const onApply = vi.fn();

    await act(async () => {
      root.render(
        <InspectorFooter
          inspectorMode="block"
          onResetStyles={vi.fn()}
          onClose={vi.fn()}
          onApply={onApply}
          applyDisabled
        />
      );
    });

    const saveBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save Block')
    );
    expect(saveBtn?.disabled).toBe(true);
    expect(saveBtn?.getAttribute('title')).toBe('No changes to save yet');

    await act(async () => {
      saveBtn?.click();
    });
    expect(onApply).not.toHaveBeenCalled();
  });

  it('names the batch target and exposes keep-open, undo and redo controls', async () => {
    const onToggleKeepOpen = vi.fn();
    const onUndo = vi.fn();
    const onRedo = vi.fn();

    await act(async () => {
      root.render(
        <InspectorFooter
          inspectorMode="block"
          onResetStyles={vi.fn()}
          onClose={vi.fn()}
          onApply={vi.fn()}
          isBatchMode
          selectedCount={4}
          onToggleKeepOpen={onToggleKeepOpen}
          onUndo={onUndo}
          onRedo={onRedo}
          canUndo
          canRedo
        />
      );
    });

    expect(container.textContent).toContain('Apply to 4 blocks');

    const keep = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Keep editing')
    );
    expect(keep?.getAttribute('aria-pressed')).toBe('false');
    await act(async () => {
      keep?.click();
    });
    expect(onToggleKeepOpen).toHaveBeenCalledTimes(1);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Undo last change"]')?.click();
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Redo last undone change"]')
        ?.click();
    });

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onRedo).toHaveBeenCalledTimes(1);
  });
});
