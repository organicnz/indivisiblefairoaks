// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentList } from '@/components/admin/content/ContentList';
import type { ContentListRow } from '@/lib/actions/content';

const deleteContent = vi.hoisted(() => vi.fn());
const setContentStatus = vi.hoisted(() => vi.fn());
const routerPush = vi.hoisted(() => vi.fn());
const searchParams = vi.hoisted(() => ({ current: null as URLSearchParams | null }));

vi.mock('@/lib/actions/content', () => ({ deleteContent, setContentStatus }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: routerPush }),
  useSearchParams: () => searchParams.current ?? new URLSearchParams(),
}));

/**
 * A draft has no public page.
 *
 * `getPublishedContent` filters to published rows, so the View link used to send
 * a draft to an HTTP 200 "Page Not Found" — indistinguishable from a typo'd
 * slug. That is the AGENTS.md "no fake controls" failure: a control that looks
 * like it works and does not.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row = (over: Partial<ContentListRow> = {}): ContentListRow =>
  ({
    id: 7,
    title: 'Meeting notes',
    slug: 'meeting-notes',
    excerpt: null,
    type: 'post',
    status: 'publish',
    published_at: '2026-09-20T18:00:00.000Z',
    featured_image: null,
    updated_at: '2026-09-20T18:00:00.000Z',
    created_at: '2026-09-01T18:00:00.000Z',
    ...over,
  }) as ContentListRow;

describe('ContentList publish-state actions', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    routerPush.mockClear();
    searchParams.current = new URLSearchParams();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (rows: ContentListRow[]) => {
    act(() => {
      root.render(
        <ContentList initialRows={rows} initialTotal={rows.length} initialPage={1} pageSize={25} />
      );
    });
  };

  const action = (label: string) =>
    [...container.querySelectorAll('a')].find((a) => a.textContent?.trim() === label);

  it('offers View, pointing at the live URL, for a published page', () => {
    render([row()]);
    expect(action('View')?.getAttribute('href')).toBe('/meeting-notes');
    expect(action('Preview')).toBeUndefined();
  });

  it('never links a draft to a URL that cannot resolve', () => {
    render([row({ status: 'draft' })]);
    // The dangerous link — a draft's slug as if it were live — must be absent.
    expect(action('View')).toBeUndefined();
    expect(
      [...container.querySelectorAll('a')].some((a) => a.getAttribute('href') === '/meeting-notes')
    ).toBe(false);
  });

  it('sends a draft to the editor preview instead, and says why', () => {
    render([row({ status: 'draft' })]);
    const preview = action('Preview');
    expect(preview?.getAttribute('href')).toBe('/admin/content/7');
    expect(preview?.getAttribute('title')).toMatch(/not published yet/i);
  });

  it('keeps Publish available on a draft, so the fix does not hide the way out', () => {
    render([row({ status: 'draft' })]);
    const publish = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Publish'
    );
    expect(publish).toBeDefined();
  });

  it('marks a slug served by a coded route as unreachable and names the reason', () => {
    render([row({ slug: 'faqs' })]);
    const badge = [...container.querySelectorAll('span')].find((span) =>
      span.textContent?.startsWith('Unreachable')
    );
    expect(badge).toBeDefined();
    expect(badge?.getAttribute('title')).toMatch(/served by a site route/i);
    expect(container.textContent).toMatch(/their own URL will not show this content/i);
  });

  it('marks a legacy redirect slug as unreachable with the redirect reason', () => {
    render([row({ slug: 'about-us' })]);
    const badge = [...container.querySelectorAll('span')].find((span) =>
      span.textContent?.startsWith('Unreachable')
    );
    expect(badge?.getAttribute('title')).toMatch(/legacy Google Sites path/i);
  });

  it('leaves an ordinary CMS slug unmarked', () => {
    render([row()]);
    expect(container.textContent).not.toContain('Unreachable');
  });

  it('toggles the unreachable filter through the URL so paging stays server-side', async () => {
    render([row({ slug: 'faqs' })]);
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();

    await act(async () => {
      checkbox?.click();
    });

    expect(routerPush).toHaveBeenCalledWith('/admin/content?hide=unreachable');
  });

  it('reads the unreachable filter from the URL', () => {
    searchParams.current = new URLSearchParams('hide=unreachable');
    render([row({ slug: 'faqs' })]);
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);
  });

  it('keeps typed search text when a filter changes', async () => {
    render([row()]);
    const input = container.querySelector<HTMLInputElement>('input[type="search"]');
    expect(input).not.toBeNull();
    if (!input) return;

    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setValue?.call(input, 'meeting');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    await act(async () => {
      checkbox?.click();
    });

    expect(routerPush).toHaveBeenCalledWith('/admin/content?q=meeting&hide=unreachable');
  });

  it('keeps typed search text when paging', () => {
    act(() => {
      root.render(
        <ContentList
          initialRows={[row()]}
          initialTotal={30}
          initialPage={1}
          pageSize={25}
        />
      );
    });

    const input = container.querySelector<HTMLInputElement>('input[type="search"]');
    expect(input).not.toBeNull();
    if (!input) return;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setValue?.call(input, 'meeting');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const next = [...container.querySelectorAll('a')].find(
      (a) => a.textContent?.trim() === 'Next'
    );
    expect(next?.getAttribute('href')).toBe('/admin/content?q=meeting&page=2');
  });

  it('reports how many rows the filter is hiding', () => {
    searchParams.current = new URLSearchParams('hide=unreachable');
    act(() => {
      root.render(
        <ContentList
          initialRows={[row()]}
          initialTotal={1}
          initialPage={1}
          pageSize={25}
          hiddenCount={14}
        />
      );
    });
    expect(container.textContent).toContain('14 unreachable rows hidden');
  });
});
