// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockBackgroundStudio } from '@/components/visual-edit/composer/BlockBackgroundStudio';
import { DEFAULT_VC_STYLES } from '@/components/visual-edit/composer/constants';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('BlockBackgroundStudio', () => {
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

  it('renders background, elevation, and ribbon accent controls', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(
        <BlockBackgroundStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          bgThemeSelectId="test-bg-theme"
          shadowSelectId="test-shadow"
        />
      );
    });

    expect(container.textContent).toContain('Background & Elevation');
    expect(container.textContent).toContain('Surface');
    expect(container.textContent).toContain('Background Theme');
    expect(container.textContent).toContain('Quick Surface Tint');
    expect(container.textContent).toContain('Elevation Shadow');
    expect(container.textContent).toContain('Element Theme Mode');
    expect(container.textContent).toContain('Surface Gradient (Pro)');
    expect(container.textContent).toContain('Shadow Aura Glow (Pro)');
    expect(container.textContent).toContain('Shape Mask / Clip Path (Pro)');
    expect(container.textContent).toContain('Decorative Badge / Ribbon Accent (Pro)');
    expect(container.textContent).toContain('Badge Label Text');
    expect(container.textContent).toContain('Badge Tone');
    expect(container.textContent).toContain('Badge Placement');
  });

  it('updates background gradient when selected', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(
        <BlockBackgroundStudio
          styles={currentStyles}
          setStyles={setStyles}
          bgGradientSelectId="test-bg-gradient"
        />
      );
    });

    const gradientSelect = container.querySelector('#test-bg-gradient') as HTMLSelectElement;
    expect(gradientSelect).not.toBeNull();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value'
      )?.set;
      nativeSetter?.call(
        gradientSelect,
        'bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent'
      );
      gradientSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setStyles).toHaveBeenCalled();
    expect(currentStyles.background.gradient).toBe(
      'bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent'
    );
  });

  it('updates badge text when input changes', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(<BlockBackgroundStudio styles={currentStyles} setStyles={setStyles} />);
    });

    const badgeInput = container.querySelector('#block-badge-text-input') as HTMLInputElement;
    expect(badgeInput).not.toBeNull();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      nativeSetter?.call(badgeInput, 'HOT');
      badgeInput.dispatchEvent(new Event('input', { bubbles: true }));
      badgeInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setStyles).toHaveBeenCalled();
    expect(currentStyles.badgeText).toBe('HOT');
  });
});
