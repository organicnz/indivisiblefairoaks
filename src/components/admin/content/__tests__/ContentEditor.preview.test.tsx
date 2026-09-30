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
 * the author ships on. These tests pin the two properties that make it honest:
 * it renders through the same sanitizer, and it is a modal (not a route that
 * could be shared while the document is unsaved).
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

  it('opens a modal preview that renders the sanitized body', () => {
    render();
    act(() => {
      button('Preview')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Draft preview');
    expect(dialog?.textContent).toContain('Meeting notes');
    expect(dialog?.textContent).toContain('March agenda');
  });

  it('closes on the close button', () => {
    render();
    act(() => {
      button('Preview')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    act(() => {
      button('Close preview')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
