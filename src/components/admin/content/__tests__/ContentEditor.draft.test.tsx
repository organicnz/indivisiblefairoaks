import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentEditor } from '@/components/admin/content/ContentEditor';
import { clearDraft, draftKey, writeDraft } from '@/lib/draft-recovery';

const saveContent = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock('@/lib/actions/content', () => ({ saveContent }));
vi.mock('sonner', () => ({ toast }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The draft an author would otherwise lose in the 2.5 seconds before autosave.
 *
 * The behaviour that matters is that recovery is *offered*, never applied: a
 * local copy silently replacing the page someone came back to is how an editor
 * loses an author's trust permanently.
 */
describe('ContentEditor draft recovery', () => {
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

  /**
   * The editor's snapshot is a `JSON.stringify` of its own field order, which
   * is not the order of `initial`. Hand-building one here would be a subtly
   * wrong string that the editor correctly treats as a different document —
   * which is exactly the confusion this suite exists to rule out. So the real
   * shape is captured from a real editing session.
   */
  const realSnapshot = async (title: string): Promise<string> => {
    // Its own container and root: the suite's are reused by the test that calls
    // this, and unmounting those would break the next render.
    const scratch = document.createElement('div');
    document.body.appendChild(scratch);
    const scratchRoot = createRoot(scratch);
    act(() => {
      scratchRoot.render(<ContentEditor initial={initial} siteHost="indivisiblefairoaks.org" />);
    });
    const input = scratch.querySelector('input[type="text"]') as HTMLInputElement;
    act(() => setNativeValue(input, title));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    const stored = window.localStorage.getItem(draftKey(7));
    act(() => scratchRoot.unmount());
    scratch.remove();
    window.localStorage.clear();
    return JSON.parse(stored as string).snapshot;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    saveContent.mockReset();
    saveContent.mockResolvedValue({ success: true, data: { id: 7 } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.localStorage.clear();
    vi.useRealTimers();
  });

  const render = () =>
    act(() => {
      root.render(<ContentEditor initial={initial} siteHost="indivisiblefairoaks.org" />);
    });

  const setNativeValue = (el: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const titleInput = () => container.querySelector('input[type="text"]') as HTMLInputElement;
  const typeInTitle = (value: string) => act(() => setNativeValue(titleInput(), value));

  const recoverBanner = () =>
    container.textContent?.includes('were found in this browser') ?? false;
  const restoreButton = () =>
    [...container.querySelectorAll('button')].find((b) => b.textContent === 'Restore them') as
      | HTMLButtonElement
      | undefined;
  const discardButton = () =>
    [...container.querySelectorAll('button')].find((b) => b.textContent === 'Discard') as
      | HTMLButtonElement
      | undefined;

  const advance = async (ms: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };

  it('says nothing when there is no stored draft', () => {
    render();
    expect(recoverBanner()).toBe(false);
  });

  it('says nothing when the stored draft is what the server sent', async () => {
    // The realistic shape of this: the author typed, autosave stored it, and
    // the leftover local copy now matches what the server has. Offering it would
    // be a recovery prompt for text that is already published.
    const snapshot = await realSnapshot('Saved work');
    writeDraft(7, snapshot);
    act(() => {
      root.render(
        <ContentEditor
          initial={{ ...initial, title: 'Saved work' }}
          siteHost="indivisiblefairoaks.org"
        />
      );
    });
    expect(recoverBanner()).toBe(false);
  });

  it('says nothing for a document nobody has edited', () => {
    // The editor only writes a draft when the document is actually dirty, so an
    // untouched page leaves nothing behind to recover.
    render();
    expect(window.localStorage.getItem(draftKey(7))).toBeNull();
    expect(recoverBanner()).toBe(false);
  });

  it('offers a differing draft, and does not apply it', async () => {
    writeDraft(7, await realSnapshot('Half-typed title'));
    render();

    expect(recoverBanner()).toBe(true);
    // The page they came back to is untouched until they choose.
    expect(titleInput().value).toBe('Meeting notes');
  });

  it('restores the draft when asked', async () => {
    writeDraft(7, await realSnapshot('Half-typed title'));
    render();
    act(() => {
      restoreButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(titleInput().value).toBe('Half-typed title');
    expect(recoverBanner()).toBe(false);
  });

  it('discards the draft and keeps the page as it was', async () => {
    writeDraft(7, await realSnapshot('Half-typed title'));
    render();
    act(() => {
      discardButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(titleInput().value).toBe('Meeting notes');
    expect(recoverBanner()).toBe(false);
    expect(window.localStorage.getItem(draftKey(7))).toBeNull();
  });

  it('makes an accepted recovery undoable', async () => {
    // Accepting by mistake should be recoverable, not merely regrettable.
    writeDraft(7, await realSnapshot('Half-typed title'));
    render();
    act(() => {
      restoreButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true })
      );
    });
    expect(titleInput().value).toBe('Meeting notes');
  });

  it('keeps a local copy of unsaved work as it is typed', async () => {
    render();
    expect(window.localStorage.getItem(draftKey(7))).toBeNull();

    typeInTitle('Work in progress');
    await advance(600);

    const stored = window.localStorage.getItem(draftKey(7));
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored as string).snapshot).toContain('Work in progress');
  });

  it('clears the local copy once the work is saved', async () => {
    render();
    typeInTitle('Work in progress');
    await advance(600);
    expect(window.localStorage.getItem(draftKey(7))).not.toBeNull();

    // Autosave stores it, so the local copy is redundant. Leaving it would offer
    // a recovery for text that is already durable.
    await advance(3000);
    expect(saveContent).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(draftKey(7))).toBeNull();
  });

  it('does not offer a recovery for a page with no id', () => {
    // A brand-new page has no stored draft to recover, and keying it by
    // "undefined" would make every unsaved new page share one slot.
    window.localStorage.setItem(
      draftKey('undefined'),
      JSON.stringify({ snapshot: 'x', savedAt: Date.now() })
    );
    act(() => {
      root.render(
        <ContentEditor
          initial={{ ...initial, id: undefined as unknown as number }}
          siteHost="indivisiblefairoaks.org"
        />
      );
    });
    expect(recoverBanner()).toBe(false);
    clearDraft(7);
  });
});
