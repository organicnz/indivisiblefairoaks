// @vitest-environment jsdom-same-realm

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataPointDrawer } from '@/components/visual-edit/DataPointDrawer';
import { getDataPoints, saveDataPoint } from '@/lib/queries/civic-client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/queries/civic-client', () => ({
  getDataPoints: vi.fn().mockResolvedValue({ dataPoints: {}, rows: [] }),
  saveDataPoint: vi.fn().mockResolvedValue({ success: true }),
}));

describe('DataPointDrawer', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.mocked(getDataPoints).mockReset();
    // Keep the label lookup pending unless a test supplies rows; otherwise it
    // settles after a synchronous assertion and warns about an un-acted update.
    vi.mocked(getDataPoints).mockReturnValue(new Promise(() => {}));
    vi.mocked(saveDataPoint).mockReset();
    vi.mocked(saveDataPoint).mockResolvedValue({ success: true });
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

  it('shows the CMS label and keeps the raw key visible', async () => {
    vi.mocked(getDataPoints).mockResolvedValue({
      dataPoints: { 'gallery.hero.headline': 'Democracy In Full View' },
      rows: [
        {
          key: 'gallery.hero.headline',
          value: 'Democracy In Full View',
          group_name: 'gallery',
          label: 'Gallery Hero Headline',
        },
      ],
    });

    await act(async () => {
      root.render(<DataPointDrawer isOpen={true} onClose={() => {}} />);
    });

    const card = document.querySelector('[data-datapoint-card="gallery.hero.headline"]');
    expect(card?.textContent).toContain('Gallery Hero Headline');
    expect(card?.textContent).toContain('gallery.hero.headline');
    expect(getDataPoints).toHaveBeenCalledWith('gallery');
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

  it('keeps a failed field modified when a batch save partially succeeds', async () => {
    vi.mocked(saveDataPoint)
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'write refused' });

    act(() => {
      root.render(<DataPointDrawer isOpen={true} onClose={() => {}} />);
    });

    const textareas = Array.from(document.querySelectorAll<HTMLTextAreaElement>('textarea'));
    expect(textareas).toHaveLength(2);

    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      textareas.forEach((textarea, index) => {
        nativeSetter?.call(textarea, `Edited field ${index + 1}`);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });

    const saveAll = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Save All')
    );
    expect(saveAll).toBeDefined();

    await act(async () => {
      saveAll?.click();
    });

    expect(saveDataPoint).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain('1 modified unsaved field(s)');
    expect(
      document
        .querySelector('[data-datapoint-card="gallery.metrics.m3_label"]')
        ?.textContent
    ).not.toContain('Modified');
    expect(
      document.querySelector('[data-datapoint-card="gallery.hero.headline"]')?.textContent
    ).toContain('Modified');
  });

  it('preserves unsaved edits when rescanning the page', () => {
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
        nativeSetter?.call(textarea, 'Unsaved rescan value');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const rescan = document.querySelector<HTMLButtonElement>('button[aria-label="Rescan page"]');
    expect(rescan).not.toBeNull();

    act(() => {
      rescan?.click();
    });

    expect(document.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(
      'Unsaved rescan value'
    );
    expect(document.querySelector('[data-datapoint-card]')?.textContent).toContain('Modified');
  });

  it('updates every rendered occurrence of a repeated key', () => {
    const duplicate = document.createElement('span');
    duplicate.setAttribute('data-data-point', 'gallery.metrics.m3_label');
    duplicate.textContent = 'Grassroots Humor';
    document.querySelector('main')?.appendChild(duplicate);

    act(() => {
      root.render(<DataPointDrawer isOpen={true} onClose={() => {}} />);
    });

    expect(document.querySelectorAll('textarea')).toHaveLength(2);

    const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
    act(() => {
      if (textarea) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        )?.set;
        nativeSetter?.call(textarea, 'Shared label');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const occurrences = document.querySelectorAll('[data-data-point="gallery.metrics.m3_label"]');
    expect(occurrences).toHaveLength(2);
    expect(Array.from(occurrences).map((node) => node.textContent)).toEqual([
      'Shared label',
      'Shared label',
    ]);
  });

  it('asks before closing with unsaved edits and restores them on discard', () => {
    const onClose = vi.fn();

    act(() => {
      root.render(<DataPointDrawer isOpen={true} onClose={onClose} />);
    });

    const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
    expect(textarea).not.toBeNull();

    act(() => {
      if (textarea) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        )?.set;
        nativeSetter?.call(textarea, 'Discard this edit');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const closeButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Close'
    );
    expect(closeButton).toBeDefined();

    act(() => {
      closeButton?.click();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();

    const discardButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Discard and close')
    );
    expect(discardButton).toBeDefined();

    act(() => {
      discardButton?.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(
      document.querySelector('[data-data-point="gallery.metrics.m3_label"]')?.textContent
    ).toBe('Grassroots Humor');
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
