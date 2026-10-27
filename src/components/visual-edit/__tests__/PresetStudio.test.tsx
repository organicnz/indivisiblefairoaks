// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_VC_STYLES } from '@/components/visual-edit/composer/constants';
import { PresetStudio } from '@/components/visual-edit/composer/PresetStudio';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('PresetStudio', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    localStorage.clear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders presets header, search, category filter pills, and presets list', async () => {
    const onApplyPreset = vi.fn();

    await act(async () => {
      root.render(<PresetStudio onApplyPreset={onApplyPreset} />);
    });

    expect(container.textContent).toContain('Professional 1-Click Design Presets');
    expect(container.textContent).toContain('Block Styles');
    expect(container.textContent).toContain('Section Templates');
    expect(container.textContent).toContain('Editorial Card');
    expect(container.textContent).toContain('Civic Gold Callout');
    expect(container.querySelector('input[placeholder*="Search block presets"]')).not.toBeNull();
  });

  it('filters presets when typing in the search bar', async () => {
    const onApplyPreset = vi.fn();

    await act(async () => {
      root.render(<PresetStudio onApplyPreset={onApplyPreset} />);
    });

    const searchInput = container.querySelector<HTMLInputElement>(
      'input[placeholder*="Search block presets"]'
    );
    expect(searchInput).not.toBeNull();

    await act(async () => {
      if (searchInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeSetter?.call(searchInput, 'Glass');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    expect(container.textContent).toContain('Frost Glass Surface');
    expect(container.textContent).not.toContain('Patriotic Navy Hero');
  });

  it('filters presets when clicking category filter pills', async () => {
    const onApplyPreset = vi.fn();

    await act(async () => {
      root.render(<PresetStudio onApplyPreset={onApplyPreset} />);
    });

    const glassBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Glass')
    );
    expect(glassBtn).toBeDefined();

    await act(async () => {
      glassBtn?.click();
    });

    expect(container.textContent).toContain('Frost Glass Surface');
    expect(container.textContent).not.toContain('Patriotic Navy Hero');
  });

  it('calls onApplyPreset when a preset card is clicked', async () => {
    const onApplyPreset = vi.fn();

    await act(async () => {
      root.render(<PresetStudio onApplyPreset={onApplyPreset} />);
    });

    const editorialPreset = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button')
    ).find((el) => el.textContent?.includes('Editorial Card'));
    expect(editorialPreset).toBeDefined();

    await act(async () => {
      editorialPreset?.click();
    });

    expect(onApplyPreset).toHaveBeenCalledTimes(1);
    expect(onApplyPreset.mock.calls[0]?.[0]?.id).toBe('editorial-card');
  });

  it('switches to Section Templates tab and lists section presets', async () => {
    const onApplyPreset = vi.fn();
    const onApplySectionPreset = vi.fn();
    const setStyles = vi.fn();

    await act(async () => {
      root.render(
        <PresetStudio
          onApplyPreset={onApplyPreset}
          onApplySectionPreset={onApplySectionPreset}
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
        />
      );
    });

    const sectionTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Section Templates')
    );
    expect(sectionTabBtn).toBeDefined();

    await act(async () => {
      sectionTabBtn?.click();
    });

    expect(container.textContent).toContain('Civic Hero Spotlight');
    expect(container.textContent).toContain('Grassroots 3-Col Matrix');
    expect(container.textContent).toContain('Split 50/50 Callout & Media');

    const heroSectionCard = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button')
    ).find((el) => el.textContent?.includes('Civic Hero Spotlight'));
    expect(heroSectionCard).toBeDefined();

    await act(async () => {
      heroSectionCard?.click();
    });

    expect(onApplySectionPreset).toHaveBeenCalledTimes(1);
    expect(onApplySectionPreset.mock.calls[0]?.[0]?.id).toBe('civic-hero-section');
  });

  it('allows saving and deleting a custom preset', async () => {
    const onApplyPreset = vi.fn();
    const setStyles = vi.fn();

    await act(async () => {
      root.render(
        <PresetStudio
          onApplyPreset={onApplyPreset}
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
        />
      );
    });

    const saveTriggerBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save Current Style as Reusable Preset')
    );
    expect(saveTriggerBtn).toBeDefined();

    await act(async () => {
      saveTriggerBtn?.click();
    });

    expect(container.textContent).toContain('Save Custom Preset');

    const nameInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="e.g. Midnight Civic Accent"]'
    );
    expect(nameInput).not.toBeNull();

    await act(async () => {
      if (nameInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeSetter?.call(nameInput, 'Custom Test Preset');
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const saveSubmitBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Save Preset'
    );
    expect(saveSubmitBtn).toBeDefined();

    await act(async () => {
      saveSubmitBtn?.click();
    });

    expect(container.textContent).toContain('Custom Test Preset');
    expect(container.textContent).toContain('Saved');

    // Click to apply custom preset
    const customCard = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (el) => el.textContent?.includes('Custom Test Preset')
    );
    expect(customCard).toBeDefined();

    await act(async () => {
      customCard?.click();
    });

    expect(onApplyPreset).toHaveBeenCalledTimes(1);
    expect(onApplyPreset.mock.calls[0]?.[0]?.name).toBe('Custom Test Preset');

    // Delete custom preset
    const deleteBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete custom preset Custom Test Preset"]'
    );
    expect(deleteBtn).not.toBeNull();

    await act(async () => {
      deleteBtn?.click();
    });

    expect(container.textContent).not.toContain('Custom Test Preset');
  });

  it('displays empty state when search finds no matches', async () => {
    const onApplyPreset = vi.fn();

    await act(async () => {
      root.render(<PresetStudio onApplyPreset={onApplyPreset} />);
    });

    const searchInput = container.querySelector<HTMLInputElement>(
      'input[placeholder*="Search block presets"]'
    );

    await act(async () => {
      if (searchInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeSetter?.call(searchInput, 'xyznonexistentpresetquery123');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    expect(container.textContent).toContain('No presets found');
    expect(container.textContent).toContain('Reset Search & Filters');

    const resetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reset Search & Filters')
    );
    await act(async () => {
      resetBtn?.click();
    });

    expect(container.textContent).toContain('Editorial Card');
  });
});
