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

  it('renders TypographyPaletteStudio and triggers alignment click and palette presets', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(<TypographyPaletteStudio styles={currentStyles} setStyles={setStyles} />);
    });

    expect(container.textContent).toContain('Text Alignment & Color Palette');
    expect(container.textContent).toContain('Live Palette & Alignment Preview');
    expect(container.textContent).toContain('1-Click Civic Palette Presets');
    expect(container.textContent).toContain('Alignment');
    expect(container.textContent).toContain('Typography Color');

    // Click Alignment button (e.g. Center)
    const alignCenterBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.querySelector('svg.lucide-align-center')
    );
    expect(alignCenterBtn).toBeDefined();

    await act(async () => {
      alignCenterBtn?.click();
    });

    expect(setStyles).toHaveBeenCalled();
    expect(currentStyles.typography.textAlign).toBe('center');

    // Click 1-Click Civic Palette Preset: Civic Gold Hero
    const goldPresetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Civic Gold Hero')
    );
    expect(goldPresetBtn).toBeDefined();

    await act(async () => {
      goldPresetBtn?.click();
    });

    expect(currentStyles.typography.color).toBe('text-amber-500');
    expect(currentStyles.typography.textAlign).toBe('center');
  });

  it('renders TypographyEffectsStudio and triggers text shadow change and effect presets', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(
        <TypographyEffectsStudio
          styles={currentStyles}
          setStyles={setStyles}
          letterSpacingSelectId="letter-spacing-select"
          textShadowSelectId="text-shadow-select"
        />
      );
    });

    expect(container.textContent).toContain('Letter Spacing, Casing & Accents');
    expect(container.textContent).toContain('Live Effects Sandbox');
    expect(container.textContent).toContain('Civic Democracy In Action');
    expect(container.textContent).toContain('1-Click Effect Presets');
    expect(container.textContent).toContain('Text Drop Shadow');

    const preview = container.querySelector('[data-testid="typography-effects-preview-text"]');
    expect(preview).not.toBeNull();

    const select = container.querySelector('#text-shadow-select') as HTMLSelectElement;
    expect(select).not.toBeNull();

    act(() => {
      select.value = 'drop-shadow-md';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setStyles).toHaveBeenCalled();
    expect(currentStyles.typography.textShadow).toBe('drop-shadow-md');

    // Click 1-Click Preset: Civic Gold Accent
    const goldAccentBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Civic Gold Accent')
    );
    expect(goldAccentBtn).toBeDefined();

    await act(async () => {
      goldAccentBtn?.click();
    });

    expect(currentStyles.typography.letterSpacing).toBe('tracking-wide');
    expect(currentStyles.typography.textTransform).toBe('capitalize');
    expect(currentStyles.typography.textDecoration).toContain('decoration-amber-500');

    // Click Reset Effects
    const resetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reset Effects')
    );
    expect(resetBtn).toBeDefined();

    await act(async () => {
      resetBtn?.click();
    });

    expect(currentStyles.typography.letterSpacing).toBe('tracking-normal');
    expect(currentStyles.typography.textDecoration).toBe('');
  });

  it('renders TypographyEditorialStudio and triggers font posture change and editorial presets', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(
        <TypographyEditorialStudio
          styles={currentStyles}
          setStyles={setStyles}
          fontStyleSelectId="font-style-select"
          textColumnsSelectId="text-columns-select"
        />
      );
    });

    expect(container.textContent).toContain('Editorial Posture, Wrap & Columns');
    expect(container.textContent).toContain('Live Editorial Flow Stage');
    expect(container.textContent).toContain('1-Click Editorial Presets');
    expect(container.textContent).toContain('Font Posture / Style');

    const preview = container.querySelector('[data-testid="typography-editorial-preview-text"]');
    expect(preview).not.toBeNull();

    const select = container.querySelector('#font-style-select') as HTMLSelectElement;
    expect(select).not.toBeNull();

    act(() => {
      select.value = 'italic';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setStyles).toHaveBeenCalled();
    expect(currentStyles.typography.fontStyle).toBe('italic');

    // Click 1-Click Preset: 2-Column Newspaper
    const newspaperBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('2-Column Newspaper')
    );
    expect(newspaperBtn).toBeDefined();

    await act(async () => {
      newspaperBtn?.click();
    });

    expect(currentStyles.typography.textColumns).toBe('columns-1 md:columns-2 gap-8');
    expect(currentStyles.typography.textWrap).toBe('text-pretty');

    // Click Reset Editorial
    const resetEditorialBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reset Editorial')
    );
    expect(resetEditorialBtn).toBeDefined();

    await act(async () => {
      resetEditorialBtn?.click();
    });

    expect(currentStyles.typography.textColumns).toBe('');
    expect(currentStyles.typography.textWrap).toBe('');
  });

  it('renders complete composed TypographyStudio with sub-tabs', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(<TypographyStudio styles={DEFAULT_VC_STYLES} setStyles={setStyles} />);
    });

    expect(container.textContent).toContain('All Type');
    expect(container.textContent).toContain('Scale & Font');
    expect(container.textContent).toContain('Color & Align');
    expect(container.textContent).toContain('Casing & Accents');
    expect(container.textContent).toContain('Columns & Wrap');

    expect(container.textContent).toContain('Font Family, Scale & Hierarchy');
    expect(container.textContent).toContain('Text Alignment & Color Palette');
    expect(container.textContent).toContain('Letter Spacing, Casing & Accents');
    expect(container.textContent).toContain('Editorial Posture, Wrap & Columns');
  });

  it('filters controls when activeTypographyTab is scale', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(
        <TypographyStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          activeTypographyTab="scale"
        />
      );
    });

    expect(container.textContent).toContain('Font Family, Scale & Hierarchy');
    expect(container.textContent).not.toContain('Text Alignment & Color Palette');
    expect(container.textContent).not.toContain('Editorial Posture, Wrap & Columns');
  });
});
