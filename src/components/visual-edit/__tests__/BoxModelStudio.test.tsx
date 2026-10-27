// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoxModelStudio } from '@/components/visual-edit/composer/BoxModelStudio';
import {
  BoxModelSpacingStudio,
  MultiColumnLayoutStudio,
  ResponsiveVisibilityStudio,
} from '@/components/visual-edit/composer/box-model';
import { DEFAULT_VC_STYLES } from '@/components/visual-edit/composer/constants';
import type { Block } from '@/lib/blocks';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockBlock: Block = {
  id: 'block-test-1',
  type: 'paragraph',
  html: 'Test paragraph content',
};

describe('BoxModelStudio and Sub-Studios', () => {
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

  it('renders all tabs and master controls in BoxModelStudio by default', async () => {
    const setStyles = vi.fn();
    const setIsSidesLinked = vi.fn();
    const cycleMarginValue = vi.fn();
    const cyclePaddingValue = vi.fn();

    await act(async () => {
      root.render(
        <BoxModelStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          currentBlock={mockBlock}
          isSidesLinked={true}
          setIsSidesLinked={setIsSidesLinked}
          cycleMarginValue={cycleMarginValue}
          cyclePaddingValue={cyclePaddingValue}
        />
      );
    });

    expect(container.textContent).toContain('All Controls');
    expect(container.textContent).toContain('Spacing & Box');
    expect(container.textContent).toContain('Grid & Cols');
    expect(container.textContent).toContain('Borders');
    expect(container.textContent).toContain('Atmosphere');
    expect(container.textContent).toContain('Dimensions');
    expect(container.textContent).toContain('Filters');
    expect(container.textContent).toContain('3D Tilt');
    expect(container.textContent).toContain('Visibility');

    // In 'all' mode, sub-sections are rendered
    expect(container.textContent).toContain('Spacing & Padding');
    expect(container.textContent).toContain('Layout & Multi-Columns');
    expect(container.textContent).toContain('Responsive Device Visibility');
  });

  it('filters to spacing only when activeSubTab is spacing', async () => {
    const setStyles = vi.fn();
    const setIsSidesLinked = vi.fn();
    const cycleMarginValue = vi.fn();
    const cyclePaddingValue = vi.fn();

    await act(async () => {
      root.render(
        <BoxModelStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          currentBlock={mockBlock}
          isSidesLinked={true}
          setIsSidesLinked={setIsSidesLinked}
          cycleMarginValue={cycleMarginValue}
          cyclePaddingValue={cyclePaddingValue}
          activeSubTab="spacing"
        />
      );
    });

    expect(container.textContent).toContain('Spacing & Padding');
    expect(container.textContent).not.toContain('Layout & Multi-Columns');
    expect(container.textContent).not.toContain('Responsive Device Visibility');
  });

  it('renders and interacts with MultiColumnLayoutStudio presets', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(<MultiColumnLayoutStudio styles={DEFAULT_VC_STYLES} setStyles={setStyles} />);
    });

    expect(container.textContent).toContain('Layout & Multi-Columns');
    expect(container.textContent).toContain('1-Click Column Presets');
    expect(container.textContent).toContain('50 / 50');
    expect(container.textContent).toContain('33 / 33 / 33');

    const twoColButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('50 / 50')
    );
    expect(twoColButton).toBeDefined();

    await act(async () => {
      twoColButton?.click();
    });

    expect(setStyles).toHaveBeenCalled();
  });

  it('renders and interacts with ResponsiveVisibilityStudio toggles', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(<ResponsiveVisibilityStudio styles={DEFAULT_VC_STYLES} setStyles={setStyles} />);
    });

    expect(container.textContent).toContain('Responsive Device Visibility');
    expect(container.textContent).toContain('Hide Mobile');
    expect(container.textContent).toContain('Hide Tablet');
    expect(container.textContent).toContain('Hide Desktop');
    expect(container.textContent).toContain('Hide on Print');

    const hideMobileButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Hide Mobile')
    );
    expect(hideMobileButton).toBeDefined();

    await act(async () => {
      hideMobileButton?.click();
    });

    expect(setStyles).toHaveBeenCalled();
  });

  it('renders BoxModelSpacingStudio and quick selects', async () => {
    const setStyles = vi.fn();
    const setIsSidesLinked = vi.fn();
    const cycleMarginValue = vi.fn();
    const cyclePaddingValue = vi.fn();

    await act(async () => {
      root.render(
        <BoxModelSpacingStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          currentBlock={mockBlock}
          isSidesLinked={true}
          setIsSidesLinked={setIsSidesLinked}
          cycleMarginValue={cycleMarginValue}
          cyclePaddingValue={cyclePaddingValue}
        />
      );
    });

    expect(container.textContent).toContain('Spacing & Padding');
    expect(container.textContent).toContain('Quick Margin');
    expect(container.textContent).toContain('Quick Padding');
  });
});
