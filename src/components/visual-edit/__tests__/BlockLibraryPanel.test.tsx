// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockLibraryPanel } from '@/components/visual-edit/BlockLibraryPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('BlockLibraryPanel', () => {
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

  it('renders title, categories, and element cards in embedded mode', async () => {
    await act(async () => {
      root.render(<BlockLibraryPanel onInsertBlock={vi.fn()} embedded={true} />);
    });

    expect(container.textContent).toContain('Visual Composer Element Library');
    expect(container.textContent).toContain('Click an element to insert into page');
    expect(container.textContent).toContain('All');
    expect(container.textContent).toContain('Typography');
    expect(container.textContent).toContain('Media');
    expect(container.textContent).toContain('Action');
    expect(container.textContent).toContain('Structure');
    expect(container.textContent).toContain('Hero Heading H1');
    expect(container.textContent).toContain('Data Table Grid');
  });

  it('shows target insertion index when insertTargetIndex is provided', async () => {
    await act(async () => {
      root.render(
        <BlockLibraryPanel
          onInsertBlock={vi.fn()}
          insertTargetIndex={3}
          embedded={true}
        />
      );
    });

    expect(container.textContent).toContain('Insert element above block #4');
  });

  it('filters by category button click', async () => {
    await act(async () => {
      root.render(<BlockLibraryPanel onInsertBlock={vi.fn()} embedded={true} />);
    });

    const mediaCategoryBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Media'
    );
    expect(mediaCategoryBtn).toBeDefined();

    await act(async () => {
      mediaCategoryBtn?.click();
    });

    expect(container.textContent).toContain('Supabase S3 Image');
    expect(container.textContent).not.toContain('Hero Heading H1');
  });

  it('filters by text input and clears search', async () => {
    await act(async () => {
      root.render(<BlockLibraryPanel onInsertBlock={vi.fn()} embedded={true} />);
    });

    const searchInput = container.querySelector<HTMLInputElement>('input[type="text"]');
    expect(searchInput).not.toBeNull();

    if (searchInput) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(searchInput, 'donation');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    expect(container.textContent).toContain('Grassroots Donation CTA');
    expect(container.textContent).not.toContain('Hero Heading H1');

    // Click clear search button
    const clearBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Clear search"]');
    expect(clearBtn).not.toBeNull();

    await act(async () => {
      clearBtn?.click();
    });

    expect(container.textContent).toContain('Hero Heading H1');
  });

  it('calls onInsertBlock and onClose on card selection', async () => {
    const onInsert = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <BlockLibraryPanel
          onInsertBlock={onInsert}
          onClose={onClose}
          insertTargetIndex={1}
          embedded={false}
        />
      );
    });

    const heroHeading = Array.from(container.querySelectorAll('h3')).find(
      (h) => h.textContent?.trim() === 'Hero Heading H1'
    );
    expect(heroHeading).toBeDefined();

    const cardBtn = heroHeading?.closest('button');
    expect(cardBtn).toBeDefined();

    await act(async () => {
      cardBtn?.click();
    });

    expect(onInsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'h1', title: 'Hero Heading H1' }),
      1
    );
    expect(onClose).toHaveBeenCalled();
  });
});
