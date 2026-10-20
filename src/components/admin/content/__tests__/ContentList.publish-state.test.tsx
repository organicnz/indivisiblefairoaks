// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentList } from '@/components/admin/content/ContentList';
import type { ContentListRow } from '@/lib/actions/content';

const deleteContent = vi.hoisted(() => vi.fn());
const setContentStatus = vi.hoisted(() => vi.fn());

vi.mock('@/lib/actions/content', () => ({ deleteContent, setContentStatus }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
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
});
