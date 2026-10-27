// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_VC_STYLES } from '@/components/visual-edit/composer/constants';
import {
  DimensionsBehaviorStudio,
  DimensionsFlexStudio,
  DimensionsPositioningStudio,
  DimensionsSizingStudio,
} from '@/components/visual-edit/composer/dimensions';
import { LayoutDimensionsStudio } from '@/components/visual-edit/composer/LayoutDimensionsStudio';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Dimensions Sub-Studios', () => {
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

  it('renders DimensionsSizingStudio and updates width and aspect ratio', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(
        <DimensionsSizingStudio
          styles={currentStyles}
          setStyles={setStyles}
          layoutWidthSelectId="test-width-select"
          layoutAspectRatioSelectId="test-aspect-select"
        />
      );
    });

    expect(container.textContent).toContain('Layout, Display & Sizing');
    expect(container.textContent).toContain('Element Width');
    expect(container.textContent).toContain('Aspect Ratio');

    const widthSelect = container.querySelector('#test-width-select') as HTMLSelectElement;
    expect(widthSelect).not.toBeNull();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value'
      )?.set;
      nativeSetter?.call(widthSelect, 'w-1/2');
      widthSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setStyles).toHaveBeenCalled();
    expect(currentStyles.layout.width).toBe('w-1/2');
  });

  it('renders DimensionsFlexStudio with flex direction and justify controls', async () => {
    let currentStyles = {
      ...DEFAULT_VC_STYLES,
      layout: { ...DEFAULT_VC_STYLES.layout, display: 'flex' },
    };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(
        <DimensionsFlexStudio
          styles={currentStyles}
          setStyles={setStyles}
          layoutFlexDirSelectId="test-flex-dir-select"
        />
      );
    });

    expect(container.textContent).toContain('Flexbox Flow & Alignment');
    expect(container.textContent).toContain('Direction');
    expect(container.textContent).toContain('Justify Content');
    expect(container.textContent).toContain('Align Items');

    const flexDirSelect = container.querySelector('#test-flex-dir-select') as HTMLSelectElement;
    expect(flexDirSelect).not.toBeNull();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value'
      )?.set;
      nativeSetter?.call(flexDirSelect, 'flex-col');
      flexDirSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setStyles).toHaveBeenCalled();
    expect(currentStyles.layout.flexDirection).toBe('flex-col');
  });

  it('renders DimensionsPositioningStudio with z-index and directional insets', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(
        <DimensionsPositioningStudio
          styles={currentStyles}
          setStyles={setStyles}
          layoutPositionSelectId="test-pos-select"
          layoutTopSelectId="test-top-select"
        />
      );
    });

    expect(container.textContent).toContain('Positioning, Offsets & Layering');
    expect(container.textContent).toContain('Directional Positioning Offsets (Pro)');
    expect(container.textContent).toContain('Top');

    const posSelect = container.querySelector('#test-pos-select') as HTMLSelectElement;
    expect(posSelect).not.toBeNull();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value'
      )?.set;
      nativeSetter?.call(posSelect, 'sticky top-0');
      posSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setStyles).toHaveBeenCalled();
    expect(currentStyles.layout.position).toBe('sticky top-0');
  });

  it('renders DimensionsBehaviorStudio with cursor and pointer events', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(
        <DimensionsBehaviorStudio
          styles={currentStyles}
          setStyles={setStyles}
          layoutCursorSelectId="test-cursor-select"
        />
      );
    });

    expect(container.textContent).toContain('Interaction Behavior, Pointer & Cursors');
    expect(container.textContent).toContain('Interaction & Cursor Playground');
    expect(container.textContent).toContain('1-Click Behavior Presets');
    expect(container.textContent).toContain('Cursor Behavior');
    expect(container.textContent).toContain('CSS Visibility');
    expect(container.textContent).toContain('Pointer Events');

    const cursorSelect = container.querySelector('#test-cursor-select') as HTMLSelectElement;
    expect(cursorSelect).not.toBeNull();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value'
      )?.set;
      nativeSetter?.call(cursorSelect, 'cursor-pointer');
      cursorSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setStyles).toHaveBeenCalled();
    expect(currentStyles.layout.cursor).toBe('cursor-pointer');

    // Click 1-click behavior preset: Draggable Move Handle
    const dragBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Draggable Move Handle')
    );
    expect(dragBtn).toBeDefined();
    await act(async () => {
      dragBtn?.click();
    });

    expect(currentStyles.layout.cursor).toBe('cursor-grab');
    expect(currentStyles.layout.userSelect).toBe('select-none');

    // Click Reset Default
    const resetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reset Default')
    );
    expect(resetBtn).toBeDefined();
    await act(async () => {
      resetBtn?.click();
    });

    expect(currentStyles.layout.cursor).toBe('');
    expect(currentStyles.layout.userSelect).toBe('');
  });

  it('supports sticky sub-tab filtering in LayoutDimensionsStudio', async () => {
    const setStyles = vi.fn();
    const onDimensionsTabChange = vi.fn();

    await act(async () => {
      root.render(
        <LayoutDimensionsStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          activeDimensionsTab="sizing"
          onDimensionsTabChange={onDimensionsTabChange}
        />
      );
    });

    expect(container.textContent).toContain('All Dimensions');
    expect(container.textContent).toContain('Sizing & Bounds');
    expect(container.textContent).toContain('Layout, Display & Sizing');
    // Flexbox should be filtered out when active tab is sizing
    expect(container.textContent).not.toContain('Flexbox Flow & Alignment');

    const flexTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Flexbox Flow')
    );
    expect(flexTabBtn).toBeDefined();

    await act(async () => {
      flexTabBtn?.click();
    });

    expect(onDimensionsTabChange).toHaveBeenCalledWith('flex');
  });

  it('applies 1-click flex presets and enables flex container mode', async () => {
    let currentStyles = {
      ...DEFAULT_VC_STYLES,
      layout: { ...DEFAULT_VC_STYLES.layout, display: '' },
    };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(<DimensionsFlexStudio styles={currentStyles} setStyles={setStyles} />);
    });

    expect(container.textContent).toContain('Current display mode is Normal Flow');
    const enableFlexBtn = container.querySelector(
      '[data-testid="enable-flex-container-button"]'
    ) as HTMLButtonElement;
    expect(enableFlexBtn).not.toBeNull();

    await act(async () => {
      enableFlexBtn.click();
    });

    expect(setStyles).toHaveBeenCalled();
    expect(currentStyles.layout.display).toBe('flex');

    // Click Center Stage preset
    const centerStageBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Center Stage')
    );
    expect(centerStageBtn).toBeDefined();

    await act(async () => {
      centerStageBtn?.click();
    });

    expect(currentStyles.layout.flexDirection).toBe('flex-col');
    expect(currentStyles.layout.justifyContent).toBe('justify-center');
    expect(currentStyles.layout.alignItems).toBe('items-center');
  });

  it('applies 1-click positioning and sizing presets', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(
        <>
          <DimensionsPositioningStudio styles={currentStyles} setStyles={setStyles} />
          <DimensionsSizingStudio styles={currentStyles} setStyles={setStyles} />
        </>
      );
    });

    // Test sticky top preset
    const stickyHeaderBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Sticky Header')
    );
    expect(stickyHeaderBtn).toBeDefined();

    await act(async () => {
      stickyHeaderBtn?.click();
    });

    expect(currentStyles.layout.position).toBe('sticky top-0');
    expect(currentStyles.layout.zIndex).toBe('z-30');

    // Test reading column preset
    const readingColBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reading Column')
    );
    expect(readingColBtn).toBeDefined();

    await act(async () => {
      readingColBtn?.click();
    });

    expect(currentStyles.layout.maxWidth).toBe('max-w-prose');
  });
});
