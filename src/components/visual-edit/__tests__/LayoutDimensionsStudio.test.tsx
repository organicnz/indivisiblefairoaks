// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_VC_STYLES } from '@/components/visual-edit/composer/constants';
import { LayoutDimensionsStudio } from '@/components/visual-edit/composer/LayoutDimensionsStudio';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('LayoutDimensionsStudio', () => {
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

  it('renders layout, display and sizing studio controls', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(
        <LayoutDimensionsStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          layoutDisplaySelectId="test-display-select"
          layoutMaxWidthSelectId="test-max-width-select"
          layoutPositionSelectId="test-position-select"
        />
      );
    });

    expect(container.textContent).toContain('Layout, Display & Sizing');
    expect(container.textContent).toContain('Dimensions');
    expect(container.textContent).toContain('Display Mode');
    expect(container.textContent).toContain('Max Width Container');
    expect(container.textContent).toContain('Element Width');
    expect(container.textContent).toContain('Min Width');
    expect(container.textContent).toContain('Height');
    expect(container.textContent).toContain('Min Height');
    expect(container.textContent).toContain('Position');
    expect(container.textContent).toContain('Z-Index');
    expect(container.textContent).toContain('Self Alignment');
    expect(container.textContent).toContain('Display Order');
    expect(container.textContent).toContain('Flex Sizing');
    expect(container.textContent).toContain('Aspect Ratio');
    expect(container.textContent).toContain('Media Object Fit');
    expect(container.textContent).toContain('Directional Positioning Offsets (Pro)');
    expect(container.textContent).toContain('Cursor Behavior');
    expect(container.textContent).toContain('CSS Visibility');
    expect(container.textContent).toContain('Pointer Events');
    expect(container.textContent).toContain('User Selection');

    const displaySelect = container.querySelector(
      '#test-display-select'
    ) as HTMLSelectElement | null;
    expect(displaySelect).not.toBeNull();
  });

  it('renders flex container controls when display is flex', async () => {
    const setStyles = vi.fn();
    const flexStyles = {
      ...DEFAULT_VC_STYLES,
      layout: { ...DEFAULT_VC_STYLES.layout, display: 'flex' },
    };

    await act(async () => {
      root.render(<LayoutDimensionsStudio styles={flexStyles} setStyles={setStyles} />);
    });

    expect(container.textContent).toContain('Direction');
    expect(container.textContent).toContain('Justify');
    expect(container.textContent).toContain('Align Items');
    expect(container.textContent).toContain('Wrap');
  });

  it('updates display mode and position when changed', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(
        <LayoutDimensionsStudio
          styles={currentStyles}
          setStyles={setStyles}
          layoutDisplaySelectId="test-display-select"
          layoutPositionSelectId="test-position-select"
        />
      );
    });

    const displaySelect = container.querySelector('#test-display-select') as HTMLSelectElement;
    expect(displaySelect).not.toBeNull();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value'
      )?.set;
      nativeSetter?.call(displaySelect, 'flex');
      displaySelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setStyles).toHaveBeenCalled();
    expect(currentStyles.layout.display).toBe('flex');

    const positionSelect = container.querySelector('#test-position-select') as HTMLSelectElement;
    expect(positionSelect).not.toBeNull();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value'
      )?.set;
      nativeSetter?.call(positionSelect, 'relative');
      positionSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(currentStyles.layout.position).toBe('relative');
  });
});
