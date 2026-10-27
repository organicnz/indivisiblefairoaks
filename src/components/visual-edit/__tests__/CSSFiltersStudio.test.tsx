// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CSSFiltersStudio } from '@/components/visual-edit/composer/CSSFiltersStudio';
import { DEFAULT_VC_STYLES } from '@/components/visual-edit/composer/constants';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('CSSFiltersStudio', () => {
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

  it('renders glassmorphism effects and optical filters studio', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(
        <CSSFiltersStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          effectBackdropBlurSelectId="test-blur-select"
        />
      );
    });

    expect(container.textContent).toContain('Glassmorphism & Visual Effects');
    expect(container.textContent).toContain('FX Studio');
    expect(container.textContent).toContain('Backdrop Blur');
    expect(container.textContent).toContain('Opacity');
    expect(container.textContent).toContain('Grayscale Filter');
    expect(container.textContent).toContain('Brightness');
    expect(container.textContent).toContain('Contrast');
    expect(container.textContent).toContain('Saturation');
    expect(container.textContent).toContain('Hue Shift');
    expect(container.textContent).toContain('Sepia Vintage');
    expect(container.textContent).toContain('Element Blur Filter');
    expect(container.textContent).toContain('Mix Blend Mode');

    const blurSelect = container.querySelector('#test-blur-select') as HTMLSelectElement | null;
    expect(blurSelect).not.toBeNull();
  });

  it('updates backdrop blur and opacity on select change', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(
        <CSSFiltersStudio
          styles={currentStyles}
          setStyles={setStyles}
          effectBackdropBlurSelectId="blur-sel"
        />
      );
    });

    const blurSelect = container.querySelector('#blur-sel') as HTMLSelectElement;
    await act(async () => {
      blurSelect.value = 'backdrop-blur-md';
      blurSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setStyles).toHaveBeenCalledTimes(1);
    expect(setStyles.mock.calls[0][0].effects.backdropBlur).toBe('backdrop-blur-md');
  });

  it('applies 1-click optical and filter presets and clears FX cleanly', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(<CSSFiltersStudio styles={currentStyles} setStyles={setStyles} />);
    });

    expect(container.textContent).toContain('1-Click Optical & Filter Presets (Pro)');
    expect(container.textContent).toContain('Optical Filter Preview');

    // Click Deep Frosted preset
    const buttons = Array.from(container.querySelectorAll('button'));
    const deepFrostedBtn = buttons.find((b) => b.textContent?.includes('Deep Frosted'));
    expect(deepFrostedBtn).toBeDefined();

    await act(async () => {
      deepFrostedBtn?.click();
    });

    expect(setStyles).toHaveBeenCalled();
    const updatedEffects = setStyles.mock.calls[0][0].effects;
    expect(updatedEffects.backdropBlur).toBe('backdrop-blur-xl');
    expect(updatedEffects.saturate).toBe('saturate-150');

    // Click Clear FX button
    const clearBtn = buttons.find((b) => b.textContent?.includes('Clear FX'));
    expect(clearBtn).toBeDefined();

    await act(async () => {
      clearBtn?.click();
    });

    const clearedEffects = setStyles.mock.calls[1][0].effects;
    expect(clearedEffects.backdropBlur).toBe('');
    expect(clearedEffects.saturate).toBe('');
  });
});
