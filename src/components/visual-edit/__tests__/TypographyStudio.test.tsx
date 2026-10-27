// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_VC_STYLES } from '@/components/visual-edit/composer/constants';
import {
  TypographyEditorialStudio,
  TypographyEffectsStudio,
  TypographyPaletteStudio,
  TypographyScaleStudio,
  TypographyStudio,
} from '@/components/visual-edit/composer/TypographyStudio';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('TypographyStudio & Sub-Studios', () => {
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

  it('renders TypographyScaleStudio and triggers font size change', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(
        <TypographyScaleStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          fontSizeSelectId="font-size-select"
          fontFamilySelectId="font-family-select"
        />
      );
    });

    expect(container.textContent).toContain('Font Family, Scale & Hierarchy');
    expect(container.textContent).toContain('Font Size');
    expect(container.textContent).toContain('Font Family');

    const select = container.querySelector('#font-size-select') as HTMLSelectElement;
    expect(select).not.toBeNull();

    act(() => {
      select.value = 'text-3xl';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setStyles).toHaveBeenCalled();
  });

  it('renders TypographyPaletteStudio and triggers alignment click', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(<TypographyPaletteStudio styles={DEFAULT_VC_STYLES} setStyles={setStyles} />);
    });

    expect(container.textContent).toContain('Text Alignment & Color Palette');
    expect(container.textContent).toContain('Alignment');
    expect(container.textContent).toContain('Typography Color');

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(1);

    act(() => {
      buttons[1].click();
    });

    expect(setStyles).toHaveBeenCalled();
  });

  it('renders TypographyEffectsStudio and triggers text shadow change', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(
        <TypographyEffectsStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          letterSpacingSelectId="letter-spacing-select"
          textShadowSelectId="text-shadow-select"
        />
      );
    });

    expect(container.textContent).toContain('Letter Spacing, Casing & Accents');
    expect(container.textContent).toContain('Text Drop Shadow');

    const select = container.querySelector('#text-shadow-select') as HTMLSelectElement;
    expect(select).not.toBeNull();

    act(() => {
      select.value = 'drop-shadow-md';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setStyles).toHaveBeenCalled();
  });

  it('renders TypographyEditorialStudio and triggers font posture change', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(
        <TypographyEditorialStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          fontStyleSelectId="font-style-select"
          textColumnsSelectId="text-columns-select"
        />
      );
    });

    expect(container.textContent).toContain('Editorial Posture, Wrap & Columns');
    expect(container.textContent).toContain('Font Posture / Style');

    const select = container.querySelector('#font-style-select') as HTMLSelectElement;
    expect(select).not.toBeNull();

    act(() => {
      select.value = 'italic';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setStyles).toHaveBeenCalled();
  });

  it('renders complete composed TypographyStudio without errors', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(<TypographyStudio styles={DEFAULT_VC_STYLES} setStyles={setStyles} />);
    });

    expect(container.textContent).toContain('Font Family, Scale & Hierarchy');
    expect(container.textContent).toContain('Text Alignment & Color Palette');
    expect(container.textContent).toContain('Letter Spacing, Casing & Accents');
    expect(container.textContent).toContain('Editorial Posture, Wrap & Columns');
  });
});
