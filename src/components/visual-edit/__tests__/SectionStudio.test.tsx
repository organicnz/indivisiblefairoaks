// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_VC_STYLES } from '@/components/visual-edit/composer/constants';
import { SectionStudio } from '@/components/visual-edit/composer/SectionStudio';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('SectionStudio', () => {
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

  it('renders sub-tab filter bar and all section controls by default', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(<SectionStudio styles={DEFAULT_VC_STYLES} setStyles={setStyles} />);
    });

    expect(container.textContent).toContain('All Controls');
    expect(container.textContent).toContain('Templates');
    expect(container.textContent).toContain('Layout & Grid');
    expect(container.textContent).toContain('Spacing');
    expect(container.textContent).toContain('Atmosphere & Glow');
    expect(container.textContent).toContain('Advanced & Selectors');

    // By default 'all' shows presets, layout, and spacing
    expect(container.textContent).toContain('1-Click Section Presets');
    expect(container.textContent).toContain('Canvas & Container Structure');
    expect(container.textContent).toContain('Spacing & Geometry');
  });

  it('filters controls when activeSectionTab is set to spacing', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(
        <SectionStudio
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          activeSectionTab="spacing"
        />
      );
    });

    expect(container.textContent).toContain('Spacing & Geometry');
    expect(container.textContent).not.toContain('1-Click Section Presets');
    expect(container.textContent).not.toContain('Canvas & Container Structure');
  });

  it('filters controls when clicking sub-tab buttons', async () => {
    const setStyles = vi.fn();

    await act(async () => {
      root.render(<SectionStudio styles={DEFAULT_VC_STYLES} setStyles={setStyles} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const templatesBtn = buttons.find((btn) => btn.textContent?.includes('Templates'));
    expect(templatesBtn).toBeDefined();

    await act(async () => {
      templatesBtn?.click();
    });

    expect(container.textContent).toContain('1-Click Section Presets');
    expect(container.textContent).not.toContain('Canvas & Container Structure');
    expect(container.textContent).not.toContain('Spacing & Geometry');
  });

  it('updates videoUrl when typing into background video input', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(
        <SectionStudio
          styles={currentStyles}
          setStyles={setStyles}
          activeSectionTab="style"
          sectionVideoUrlInputId="test-video-url"
        />
      );
    });

    const videoInput = container.querySelector('#test-video-url') as HTMLInputElement | null;
    expect(videoInput).not.toBeNull();

    await act(async () => {
      if (videoInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeSetter?.call(videoInput, 'https://example.com/ambient.mp4');
        videoInput.dispatchEvent(new Event('input', { bubbles: true }));
        videoInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(setStyles).toHaveBeenCalled();
  });
});
