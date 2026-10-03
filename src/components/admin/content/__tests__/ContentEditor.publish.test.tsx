import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentEditor } from '@/components/admin/content/ContentEditor';

/**
 * Publishing must publish the document on screen.
 *
 * `handleSetStatus` called `setContentStatus`, which writes `status` and
 * `published_at` and nothing else, and then called `setSavedSnapshot` over the
 * whole field set. That marked the editor clean, so the autosave effect
 * short-circuited on `if (!dirty) return`, `beforeunload` stopped warning, and
 * the indicator read "All changes saved" — while every unsaved edit on screen
 * was discarded. The button most likely to be pressed at the end of a writing
 * session was the one that threw the work away and reported success.
 *
 * These tests pin the behaviour that replaced it: unsaved work goes out with
 * the publish, and every control that names a publish state routes through that
 * one function — including the Status dropdown, which is covered in
 * `ContentEditor.safety.test.tsx` because its failure mode was invisible here.
 */

const saveContent = vi.hoisted(() => vi.fn());
const setContentStatus = vi.hoisted(() => vi.fn());
const deleteContent = vi.hoisted(() => vi.fn());
const duplicateContent = vi.hoisted(() => vi.fn());
const getContentRevisions = vi.hoisted(() => vi.fn());
const restoreContentRevision = vi.hoisted(() => vi.fn());
const uploadContentImage = vi.hoisted(() => vi.fn());
const deleteContentImage = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock('@/lib/actions/content', () => ({
  saveContent,
  setContentStatus,
  deleteContent,
  duplicateContent,
  getContentRevisions,
  restoreContentRevision,
  uploadContentImage,
  deleteContentImage,
}));
vi.mock('sonner', () => ({ toast }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), push: vi.fn() }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Publishing does not discard unsaved edits', () => {
  let container: HTMLDivElement;
  let root: Root;

  const initial = {
    id: 7,
    slug: 'meeting-notes',
    title: 'Meeting notes',
    body: '<p>March agenda</p>',
    excerpt: '',
    type: 'post',
    status: 'draft' as const,
    featuredImage: '',
    publishedAt: null as string | null,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    for (const m of [
      saveContent,
      setContentStatus,
      deleteContent,
      duplicateContent,
      getContentRevisions,
      restoreContentRevision,
      uploadContentImage,
      deleteContentImage,
    ]) {
      m.mockReset();
    }
    saveContent.mockResolvedValue({ success: true, data: { id: 7 }, status: 'publish' });
    setContentStatus.mockResolvedValue({ success: true, data: { id: 7 } });
    toast.error.mockReset();
    toast.success.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const render = (overrides: Record<string, unknown> = {}) => {
    act(() => {
      root.render(
        <ContentEditor
          initial={{ ...initial, ...overrides } as typeof initial}
          siteHost="indivisiblefairoaks.org"
        />
      );
    });
  };

  const setNativeValue = (el: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const titleInput = () => container.querySelector('input[type="text"]') as HTMLInputElement;

  const type = (value: string) => {
    act(() => setNativeValue(titleInput(), value));
  };

  const publishButton = () =>
    Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Publish'
    ) as HTMLButtonElement;

  const click = (el: HTMLElement) => {
    act(() => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };

  it('saves the whole document at the new status rather than flipping status alone', async () => {
    render();

    // An unsaved edit, not yet flushed to the server.
    type('Meeting notes — revised');
    expect(saveContent).not.toHaveBeenCalled();

    await act(async () => {
      click(publishButton());
    });

    // The whole document goes out, carrying the edited title and status:
    // 'publish'. Not a status-only write that drops the edit.
    expect(setContentStatus).not.toHaveBeenCalled();
    expect(saveContent).toHaveBeenCalledTimes(1);
    const payload = saveContent.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.title).toBe('Meeting notes — revised');
    expect(payload.status).toBe('publish');
  });

  it('still flushes a body edit, not just the title', async () => {
    render();

    const editable = container.querySelector('[contenteditable="true"]') as HTMLElement;
    act(() => {
      editable.innerHTML = '<p>April agenda</p>';
      editable.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // BlockEditor coalesces body input on a ~120ms timer before it reaches the
    // model, so without flushing it the document is still clean and the publish
    // correctly takes the status-only path.
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    await act(async () => {
      click(publishButton());
    });

    const payload = saveContent.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.body).toContain('April agenda');
  });

  it('falls back to a status-only toggle when there is nothing unsaved', async () => {
    // The narrow path is still correct and still cheaper: with a clean document
    // there is nothing to lose, so this must not start writing a full copy.
    render();

    await act(async () => {
      click(publishButton());
    });

    expect(setContentStatus).toHaveBeenCalledWith(7, 'publish');
    expect(saveContent).not.toHaveBeenCalled();
  });

  it('does not report the document as saved while an edit is still outstanding', async () => {
    render();
    type('Something new');

    // The unsaved indicator must survive a failed publish. The original bug
    // cleared it on any toggle, so a failure left the editor claiming the work
    // was stored when it was not.
    saveContent.mockResolvedValue({ success: false, error: 'Nope' });
    await act(async () => {
      click(publishButton());
    });

    expect(toast.error).toHaveBeenCalledWith('Nope');
    const text = container.textContent ?? '';
    expect(text).toMatch(/unsaved|nope/i);
  });
});
