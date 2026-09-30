import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentEditor } from '@/components/admin/content/ContentEditor';

const saveContent = vi.hoisted(() => vi.fn());
const getContentRevisions = vi.hoisted(() => vi.fn());
const restoreContentRevision = vi.hoisted(() => vi.fn());
const getContentForEdit = vi.hoisted(() => vi.fn());
const setContentStatus = vi.hoisted(() => vi.fn());
const deleteContent = vi.hoisted(() => vi.fn());
const duplicateContent = vi.hoisted(() => vi.fn());
const uploadContentImage = vi.hoisted(() => vi.fn());
const deleteContentImage = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock('@/lib/actions/content', () => ({
  saveContent,
  getContentRevisions,
  restoreContentRevision,
  getContentForEdit,
  setContentStatus,
  deleteContent,
  duplicateContent,
  uploadContentImage,
  deleteContentImage,
}));
vi.mock('sonner', () => ({ toast }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));

/**
 * A preview that styled itself differently from the public page would be a lie
 * the author ships on. These tests pin the properties that make it honest:
 * it renders through the same sanitizer, it is a modal (not a route that could
 * be shared while the document is unsaved), and it holds focus while it is open.
 *
 * The dialog is a Radix portal, so it lands on `document.body` rather than
 * inside the render container. That is not incidental — it is why the preview
 * cannot be clipped by the editor's own overflow.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ContentEditor preview', () => {
  let container: HTMLDivElement;
  let root: Root;

  const initial = {
    id: 7,
    slug: 'meeting-notes',
    title: 'Meeting notes',
    body: '<p>March agenda</p>',
    excerpt: '',
    type: 'post',
    status: 'publish' as const,
    featuredImage: '',
    publishedAt: '2026-09-20T18:00:00.000Z',
    // Deliberately different from `publishedAt`. The public page prints
    // `created_at` as "Published", so the preview must be handed that one.
    createdAt: '2026-03-02T12:00:00.000Z',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    saveContent.mockResolvedValue({ success: true, data: { id: 7 } });
    getContentRevisions.mockResolvedValue({ success: true, data: { revisions: [] } });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    // The Radix portal outlives the tree, so the popper wrapper has to be swept
    // or the next test queries a dialog it did not open.
    for (const node of document.querySelectorAll('[data-radix-popper-content-wrapper]')) {
      node.remove();
    }
    vi.useRealTimers();
  });

  const render = () => {
    act(() => {
      root.render(<ContentEditor initial={initial} siteHost="indivisiblefairoaks.org" />);
    });
  };

  const button = (text: string) =>
    [...container.querySelectorAll('button')].find((b) => b.textContent === text) as
      | HTMLButtonElement
      | undefined;

  const openPreview = () => {
    act(() => {
      button('Preview')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });
  };

  const dialog = () => document.body.querySelector('[role="dialog"]');

  it('opens a modal preview that renders the sanitized body', () => {
    render();
    openPreview();
    const el = dialog();
    expect(el).not.toBeNull();
    expect(el?.textContent).toContain('Draft preview');
    expect(el?.textContent).toContain('Meeting notes');
    expect(el?.textContent).toContain('March agenda');
  });

  it('closes on the close button', () => {
    render();
    openPreview();
    expect(dialog()).not.toBeNull();
    act(() => {
      const close = Array.from(document.body.querySelectorAll('button')).find(
        (b) => b.textContent === 'Close preview'
      );
      close?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(dialog()).toBeNull();
  });

  it('prints the created-at date the public page prints, not the publish date', () => {
    // The preview used to be given `publishedAt`. Those are different values,
    // and `publishedAt` is null for anything never explicitly published — so
    // the preview showed no date at all where the live page showed one.
    render();
    openPreview();
    const time = dialog()?.querySelector('time');
    expect(time?.getAttribute('datetime')).toBe('2026-03-02T12:00:00.000Z');
    expect(time?.textContent).toContain('March');
    expect(time?.textContent).not.toContain('September');
  });

  it('holds focus inside the dialog instead of letting it escape to the editor', () => {
    // The hand-rolled version declared aria-modal and focused the close button
    // but trapped nothing, so Tab walked out of the preview and into the
    // editor behind it. Radix is what fixes that; this asserts it is still fixed.
    render();
    const before = button('Preview');
    act(() => {
      before?.focus();
    });
    expect(document.activeElement).toBe(before);

    openPreview();
    const inside = dialog();
    expect(inside).not.toBeNull();
    // Focus moved into the dialog rather than staying behind it.
    expect(inside?.contains(document.activeElement)).toBe(true);
  });

  it('is labelled, so it is announced as a dialog and not as an unnamed region', () => {
    render();
    openPreview();
    const el = dialog();
    const label = el?.getAttribute('aria-label') ?? el?.getAttribute('aria-labelledby');
    expect(label).toBeTruthy();
  });
});
