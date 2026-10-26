// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockLibraryModal } from '@/components/visual-edit/BlockLibraryModal';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('BlockLibraryModal', () => {
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

  it('renders nothing when closed', async () => {
    await act(async () => {
      root.render(<BlockLibraryModal open={false} onClose={vi.fn()} onInsertBlock={vi.fn()} />);
    });
    expect(document.body.textContent).not.toContain('Visual Composer Element Library');
  });

  it('renders modal title, category filters, and element templates when open', async () => {
    await act(async () => {
      root.render(<BlockLibraryModal open={true} onClose={vi.fn()} onInsertBlock={vi.fn()} />);
    });

    expect(document.body.textContent).toContain('Visual Composer Element Library');
    expect(document.body.textContent).toContain('Typography');
    expect(document.body.textContent).toContain('Media');
    expect(document.body.textContent).toContain('Action');
    expect(document.body.textContent).toContain('Structure');
    expect(document.body.textContent).toContain('Heading H2');
    expect(document.body.textContent).toContain('Supabase S3 Image');
    expect(document.body.textContent).toContain('Action Button CTA');
  });

  it('filters templates when typing in search input', async () => {
    await act(async () => {
      root.render(<BlockLibraryModal open={true} onClose={vi.fn()} onInsertBlock={vi.fn()} />);
    });

    const searchInput = document.querySelector<HTMLInputElement>('input[type="text"]');
    expect(searchInput).not.toBeNull();

    if (searchInput) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) {
          setter.call(searchInput, 'table');
        }
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    expect(document.body.textContent).toContain('Data Table Grid');
    expect(document.body.textContent).not.toContain('Heading H2');
  });

  it('calls onInsertBlock and onClose when template card is clicked', async () => {
    const onInsertBlock = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <BlockLibraryModal
          open={true}
          onClose={onClose}
          onInsertBlock={onInsertBlock}
          insertTargetIndex={2}
        />
      );
    });

    const headingCard = Array.from(document.querySelectorAll('h3')).find(
      (h) => h.textContent?.trim() === 'Heading H2'
    );
    expect(headingCard).toBeDefined();

    const cardButton = headingCard?.closest('button');
    expect(cardButton).toBeDefined();

    await act(async () => {
      cardButton?.click();
    });

    expect(onInsertBlock).toHaveBeenCalledTimes(1);
    expect(onInsertBlock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'h2', title: 'Heading H2' }),
      2
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
