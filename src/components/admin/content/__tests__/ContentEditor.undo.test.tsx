import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentEditor } from '@/components/admin/content/ContentEditor';

const saveContent = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock('@/lib/actions/content', () => ({ saveContent }));
vi.mock('sonner', () => ({ toast }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));

/**
 * Undo/redo as the author experiences it.
 *
 * The history module has its own unit tests. What matters here is the wiring:
 * that a keystroke is grouped into one step, that a structural edit is not, and
 * that undo restores the document rather than only the model — a bug there would
 * leave the title or the slug showing one thing and the body another.
 */
// Undo is recorded by an effect, so every state update has to be flushed
// inside act() for the stack to reflect the edit before the next assertion.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ContentEditor undo/redo', () => {
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
    publishedAt: null as string | null,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    saveContent.mockReset();
    saveContent.mockResolvedValue({ success: true, data: { id: 7 } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
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

  const setNativeValue = (el: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const titleInput = () => container.querySelector('input[type="text"]') as HTMLInputElement;
  const typeInTitle = (value: string) => act(() => setNativeValue(titleInput(), value));

  const press = (key: string, opts: { shift?: boolean } = {}) =>
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key,
          metaKey: true,
          shiftKey: opts.shift ?? false,
          bubbles: true,
          cancelable: true,
        })
      );
    });

  const undoButton = () =>
    container.querySelector('button[aria-label="Undo"]') as HTMLButtonElement;
  const redoButton = () =>
    container.querySelector('button[aria-label="Redo"]') as HTMLButtonElement;

  it('starts with both directions unavailable', () => {
    render();
    expect(undoButton().disabled).toBe(true);
    expect(redoButton().disabled).toBe(true);
  });

  it('undoes a title edit and offers redo', () => {
    render();
    typeInTitle('Meeting notes revised');
    expect(titleInput().value).toBe('Meeting notes revised');

    expect(undoButton().disabled).toBe(false);
    press('z');
    expect(titleInput().value).toBe('Meeting notes');
    expect(undoButton().disabled).toBe(true);
    expect(redoButton().disabled).toBe(false);
  });

  it('redoes with Cmd+Shift+Z', () => {
    render();
    typeInTitle('Meeting notes revised');
    press('z');
    press('z', { shift: true });
    expect(titleInput().value).toBe('Meeting notes revised');
    expect(redoButton().disabled).toBe(true);
  });

  it('redoes with Cmd+Y too, because both spellings are expected', () => {
    render();
    typeInTitle('Revised');
    press('z');
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'y', metaKey: true, bubbles: true, cancelable: true })
      );
    });
    expect(titleInput().value).toBe('Revised');
  });

  it('treats a burst of typing as one step', () => {
    // The reason coalescing exists: without it, undo removes one character and
    // the author concludes the editor is broken.
    render();
    typeInTitle('M');
    typeInTitle('Me');
    typeInTitle('Meeting notes v2');
    press('z');
    expect(titleInput().value).toBe('Meeting notes');
  });

  it('separates edits that happened a while apart', () => {
    render();
    typeInTitle('Meeting notes v2');
    act(() => vi.advanceTimersByTime(2000));
    typeInTitle('Meeting notes v3');
    press('z');
    expect(titleInput().value).toBe('Meeting notes v2');
  });

  it('discards the redo stack once a new edit is made', () => {
    render();
    typeInTitle('First');
    press('z');
    expect(redoButton().disabled).toBe(false);

    typeInTitle('Second');
    expect(redoButton().disabled).toBe(true);
    expect(titleInput().value).toBe('Second');
  });

  it('is undoable from the button, not only the shortcut', () => {
    render();
    typeInTitle('Changed');
    act(() => {
      undoButton().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(titleInput().value).toBe('Meeting notes');
  });

  it('restores the whole document, not just the body', () => {
    // The body is derived from the blocks; if undo restored only the model, the
    // title would still read "changed" while the page said otherwise.
    render();
    typeInTitle('A different title');
    act(() => {
      const image = container.querySelector('input[type="url"]') as HTMLInputElement;
      setNativeValue(image, 'https://example.com/hero.jpg');
    });

    press('z');
    press('z');

    expect(titleInput().value).toBe('Meeting notes');
    const image = container.querySelector('input[type="url"]') as HTMLInputElement;
    expect(image.value).toBe('');
  });

  it('persists the undo, because the stored row is no longer what is on screen', async () => {
    // Autosave already stored "Changed", so undoing to the original title
    // leaves the document differing from what was written. That second write is
    // required, not churn: skipping it would leave the published page showing
    // text the editor no longer has.
    render();
    typeInTitle('Changed');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(saveContent).toHaveBeenCalledTimes(1);
    expect(saveContent.mock.calls[0][0].title).toBe('Changed');

    press('z');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(saveContent).toHaveBeenCalledTimes(2);
    expect(saveContent.mock.calls[1][0].title).toBe('Meeting notes');
  });

  it('survives repeated undo without a stack underflow', () => {
    render();
    typeInTitle('One');
    typeInTitle('One two');
    for (let i = 0; i < 6; i += 1) press('z');
    expect(titleInput().value).toBe('Meeting notes');
    expect(() => press('z')).not.toThrow();
  });
});
