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
});
