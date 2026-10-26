// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataPointDrawer } from '@/components/visual-edit/DataPointDrawer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/queries/civic-client', () => ({
  saveDataPoint: vi.fn().mockResolvedValue({ success: true }),
}));

describe('DataPointDrawer', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    const main = document.createElement('main');
    main.innerHTML = `
      <span data-data-point="gallery.metrics.m3_label">Grassroots Humor</span>
      <h1 data-data-point="gallery.hero.headline">Democracy In Full View</h1>
    `;
    document.body.appendChild(main);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('scans and renders live DataPoints from the DOM', () => {
    act(() => {
      root.render(<DataPointDrawer isOpen={true} onClose={() => {}} />);
    });

    expect(
      document.querySelector('[data-datapoint-card="gallery.metrics.m3_label"]')
    ).not.toBeNull();
    expect(document.querySelector('[data-datapoint-card="gallery.hero.headline"]')).not.toBeNull();
  });

  it('filters data points by search query', () => {
    act(() => {
      root.render(<DataPointDrawer isOpen={true} onClose={() => {}} />);
    });

    const searchInput = document.querySelector<HTMLInputElement>(
      'input[placeholder*="Search keys"]'
    );
    expect(searchInput).not.toBeNull();

    act(() => {
      if (searchInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeSetter?.call(searchInput, 'Humor');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    expect(
      document.querySelector('[data-datapoint-card="gallery.metrics.m3_label"]')
    ).not.toBeNull();
    expect(document.querySelector('[data-datapoint-card="gallery.hero.headline"]')).toBeNull();
  });

  it('syncs live edits to the DOM text and allows saving', async () => {
    const { saveDataPoint } = await import('@/lib/queries/civic-client');

    act(() => {
      root.render(<DataPointDrawer isOpen={true} onClose={() => {}} />);
    });

    const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
    expect(textarea).not.toBeNull();

    act(() => {
      if (textarea) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        )?.set;
        nativeSetter?.call(textarea, 'Community Laughs');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Check live DOM sync
    const el = document.querySelector('[data-data-point="gallery.metrics.m3_label"]');
    expect(el?.textContent).toBe('Community Laughs');

    // Click Save Field
    const saveBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save Field')
    );
    expect(saveBtn).toBeDefined();

    await act(async () => {
      saveBtn?.click();
    });

    expect(saveDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'gallery.metrics.m3_label',
        value: 'Community Laughs',
      })
    );
  });

  it('spotlights element when Spotlight button is clicked', () => {
    const scrollMock = vi.fn();
    Element.prototype.scrollIntoView = scrollMock;

    act(() => {
      root.render(<DataPointDrawer isOpen={true} onClose={() => {}} />);
    });

    const spotlightBtn = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Spotlight gallery.metrics.m3_label"]'
    );
    expect(spotlightBtn).not.toBeNull();

    act(() => {
      spotlightBtn?.click();
    });

    expect(scrollMock).toHaveBeenCalled();
  });
});
