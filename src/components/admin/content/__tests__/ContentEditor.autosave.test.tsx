// @vitest-environment jsdom
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

/** The autosave contract, which is what this file exists to pin. */
describe('ContentEditor autosave', () => {
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

  const settle = async (ms = 3000) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };

  it('does not write on load', async () => {
    render();
    await settle();
    expect(saveContent).not.toHaveBeenCalled();
  });

  it('debounces a burst of typing into a single write', async () => {
    render();
    type('Meeting');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    type('Meeting notes revised');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    // Well past the 2500ms window, measured from the *second* keystroke.
    await settle(3000);

    expect(saveContent).toHaveBeenCalledTimes(1);
    expect(saveContent.mock.calls[0][0].title).toBe('Meeting notes revised');
  });

  it('keeps a published page published', async () => {
    // The bug this file was written for: autosave used to force `draft`, so
    // pausing mid-edit took a live page offline.
    render();
    type('Meeting notes, revised');
    await settle();

    expect(saveContent).toHaveBeenCalledTimes(1);
    expect(saveContent.mock.calls[0][0].status).toBe('publish');
  });

  it('keeps a draft a draft', async () => {
    render({ status: 'draft' });
    type('Still a draft');
    await settle();
    expect(saveContent.mock.calls[0][0].status).toBe('draft');
  });

  it('reports progress while it writes', async () => {
    let resolve: (v: unknown) => void = () => {};
    saveContent.mockImplementationOnce(() => new Promise((r) => (resolve = r)) as Promise<unknown>);
    render();
    type('Changed');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(container.textContent).toMatch(/Saving/);

    await act(async () => {
      resolve({ success: true, data: { id: 7 } });
      await Promise.resolve();
    });
    expect(container.textContent).toMatch(/All changes saved/);
  });

  it('surfaces a failed autosave with its reason, and stops retrying', async () => {
    saveContent.mockResolvedValue({ success: false, error: 'slug is already taken' });
    render();
    type('Meeting notes v2');
    await settle();
    expect(saveContent).toHaveBeenCalledTimes(1);

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toMatch(/Autosave failed/);
    expect(alert?.textContent).toMatch(/slug is already taken/);

    // It must not keep hammering a write that just failed.
    await settle(10_000);
    expect(saveContent).toHaveBeenCalledTimes(1);
  });

  it('names a stale autosave as an autosave failure, and offers reload instead of retry', async () => {
    saveContent.mockResolvedValue({
      success: false,
      error:
        'Someone else saved this page while you were editing it. Reload to see their version, then reapply your changes.',
    });
    render();
    type('Meeting notes v2');
    await settle();
    expect(saveContent).toHaveBeenCalledTimes(1);

    expect(container.textContent).toMatch(/Autosave failed/);
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toMatch(/Another editor saved this page/);
    expect(alert?.textContent).toContain('Reload onto their version');
    expect(alert?.textContent).not.toContain('Try again');
  });

  it('stops reporting a failure once the document changes', async () => {
    saveContent.mockResolvedValue({ success: false, error: 'slug is already taken' });
    render();
    type('Meeting notes v2');
    await settle();
    expect(container.textContent).toMatch(/Autosave failed/);

    saveContent.mockResolvedValue({ success: true, data: { id: 7 } });
    type('Meeting notes v3');
    await settle();
    expect(container.textContent).not.toMatch(/Autosave failed/);
    expect(container.textContent).toMatch(/All changes saved/);
  });

  it('does not autosave a page that has no content yet', async () => {
    render({ body: '<p></p>' });
    type('A brand new page');
    await settle();
    expect(saveContent).not.toHaveBeenCalled();
  });

  it('saves on Cmd+S without waiting for the debounce', async () => {
    render();
    type('Saved on demand');
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true })
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(saveContent).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Published');
  });

  it('saves on Ctrl+S too', async () => {
    render();
    type('Saved on demand');
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(saveContent).toHaveBeenCalledTimes(1);
  });

  it('refuses to save an untitled page, and says why', async () => {
    render({ title: 'Meeting notes' });
    type('   ');
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true })
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(saveContent).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/title before saving/i);
  });
});
