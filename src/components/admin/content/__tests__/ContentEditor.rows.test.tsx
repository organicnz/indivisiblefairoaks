// @vitest-environment jsdom-same-realm
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

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * A row is a layout, not a leaf. The content editor cannot edit one, but it is
 * the default destination from the content list, so it has to keep the row
 * intact while the author edits the rest of the document.
 *
 * The previous behaviour made the row a blank paragraph card whose type menu
 * replaced it with a leaf; any save after that wrote a flat body. This test
 * drives the real autosave path and asserts the row markup that reaches
 * `saveContent` is the markup the editor was given.
 */
describe('ContentEditor keeps a row intact through a save', () => {
  let container: HTMLDivElement;
  let root: Root;

  const rowBody =
    '<div class="cw-row cw-row--2">' +
    '<div class="cw-column"><h2 class="cw cw--h2">Agenda</h2><p>Doors at nine.</p></div>' +
    '<div class="cw-column"><p>Right copy</p></div>' +
    '</div>';

  const initial = {
    id: 7,
    slug: 'meeting-notes',
    title: 'Meeting notes',
    body: rowBody,
    excerpt: '',
    type: 'page',
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

  const setNativeValue = (el: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('renders a non-convertible row card and writes the row back unchanged', async () => {
    act(() => {
      root.render(<ContentEditor initial={initial} siteHost="indivisiblefairoaks.org" />);
    });

    const rowCard = container.querySelector('[data-block-type="row"]');
    expect(rowCard?.textContent).toContain('Row · 2 columns');
    expect(rowCard?.textContent).toContain('Doors at nine.');
    expect(rowCard?.querySelector('[aria-label="Insert or change block"]')).toBeNull();
    expect(rowCard?.querySelector('[aria-expanded]')).toBeNull();
    expect(rowCard?.querySelector('a[href="/compose/7"]')?.textContent).toContain(
      'Edit in Composer'
    );

    const titleInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    act(() => setNativeValue(titleInput, 'Meeting notes revised'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    expect(saveContent.mock.calls[0][0].title).toBe('Meeting notes revised');
    expect(saveContent.mock.calls[0][0].body).toBe(rowBody);
  });
});
