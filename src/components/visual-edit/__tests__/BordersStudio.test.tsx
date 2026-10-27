// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BordersStudio } from '@/components/visual-edit/composer/BordersStudio';
import { DEFAULT_VC_STYLES } from '@/components/visual-edit/composer/constants';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('BordersStudio', () => {
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

  it('renders border and corner radius controls', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(
        <BordersStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          radiusSelectId="test-radius-select"
          borderWidthSelectId="test-border-width-select"
        />
      );
    });

    expect(container.textContent).toContain('Border & Corner Radius');
    expect(container.textContent).toContain('Geometry');
    expect(container.textContent).toContain('Corner Radius');
    expect(container.textContent).toContain('Border Width');
    expect(container.textContent).toContain('Border Style');
    expect(container.textContent).toContain('Border Sides');
    expect(container.textContent).toContain('Border Color Preset');

    const radiusSelect = container.querySelector('#test-radius-select') as HTMLSelectElement | null;
    expect(radiusSelect).not.toBeNull();
  });

  it('toggles corner radius linking and displays 4-corner controls when unlinked', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(
        <BordersStudio
          styles={currentStyles}
          setStyles={setStyles}
          radiusTopLeftSelectId="test-radius-tl"
        />
      );
    });

    // Initially linked, 4-corner controls not visible
    expect(container.querySelector('#test-radius-tl')).toBeNull();

    // Toggle unlinked
    const linkToggle = container.querySelector(
      '[data-testid="corner-radius-link-toggle"]'
    ) as HTMLButtonElement | null;
    expect(linkToggle).not.toBeNull();

    await act(async () => {
      linkToggle?.click();
    });

    expect(setStyles).toHaveBeenCalled();
    expect(currentStyles.border.radiusLinked).toBe(false);

    // Re-render with unlinked state
    await act(async () => {
      root.render(
        <BordersStudio
          styles={currentStyles}
          setStyles={setStyles}
          radiusTopLeftSelectId="test-radius-tl"
        />
      );
    });

    expect(container.textContent).toContain('4-Corner Radius Controls (Pro)');
    const tlSelect = container.querySelector('#test-radius-tl') as HTMLSelectElement | null;
    expect(tlSelect).not.toBeNull();
  });

  it('updates border styles and swatches on click', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(<BordersStudio styles={currentStyles} setStyles={setStyles} />);
    });

    // Click on Civic Gold swatch
    const goldSwatch = container.querySelector(
      'button[aria-label="Select Civic Gold"]'
    ) as HTMLButtonElement | null;
    expect(goldSwatch).not.toBeNull();

    await act(async () => {
      goldSwatch?.click();
    });

    expect(setStyles).toHaveBeenCalled();
    expect(currentStyles.border.color).toBe('border-amber-500/50');
  });

  it('applies 1-click border geometry presets and clears border cleanly', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(<BordersStudio styles={currentStyles} setStyles={setStyles} />);
    });

    expect(container.textContent).toContain('1-Click Border & Corner Presets (Pro)');
    expect(container.textContent).toContain('Frame Geometry');

    // Click Civic Accent Bar preset
    const buttons = Array.from(container.querySelectorAll('button'));
    const civicAccentBtn = buttons.find((b) => b.textContent?.includes('Civic Accent Bar'));
    expect(civicAccentBtn).toBeDefined();

    await act(async () => {
      civicAccentBtn?.click();
    });

    expect(setStyles).toHaveBeenCalled();
    const updatedBorder = setStyles.mock.calls[0][0].border;
    expect(updatedBorder.side).toBe('left');
    expect(updatedBorder.width).toBe('border-4');
    expect(updatedBorder.color).toBe('border-amber-500/50');

    // Click Clear Border button
    const clearBtn = buttons.find((b) => b.textContent?.includes('Clear Border'));
    expect(clearBtn).toBeDefined();

    await act(async () => {
      clearBtn?.click();
    });

    const clearedBorder = setStyles.mock.calls[1][0].border;
    expect(clearedBorder.radius).toBe('rounded-none');
    expect(clearedBorder.width).toBe('border-0');
    expect(clearedBorder.style).toBe('none');
  });
});
