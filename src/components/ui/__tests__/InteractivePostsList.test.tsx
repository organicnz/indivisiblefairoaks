// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InteractivePostsList } from '@/components/ui/InteractivePostsList';
import type { PublishedPostSummary } from '@/lib/queries/content';

const editContext = vi.hoisted(() => ({ isAdmin: false }));

function setInputValue(input: HTMLInputElement, value: string) {
  const propsKey = Object.keys(input).find((key) => key.startsWith('__reactProps$'));
  if (!propsKey) throw new Error('React props were not attached to the input');
  const props = (
    input as unknown as Record<
      string,
      { onChange?: (event: { target: { value: string } }) => void }
    >
  )[propsKey];
  if (!props?.onChange) throw new Error('input has no onChange handler');
  props.onChange({ target: { value } });
}

vi.mock('@/components/layout/useEditContext', () => ({
  useEditContext: () => ({ loading: false, isAdmin: editContext.isAdmin, target: null }),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SAMPLE_POSTS: PublishedPostSummary[] = [
  {
    id: 101,
    title: 'Why Fair Oaks Needs Strong Public Schools',
    slug: 'fair-oaks-public-schools',
    excerpt: 'A deep look at local school board policies and community funding.',
    featured_image: null,
    published_at: '2026-10-10T12:00:00Z',
    created_at: '2026-10-09T10:00:00Z',
  },
  {
    id: 102,
    title: 'Mobilizing Carmichael: From Street Rallies to Town Halls',
    slug: 'mobilizing-carmichael',
    excerpt: 'Our organizing trajectory heading into the upcoming general election.',
    featured_image: null,
    published_at: '2026-10-15T12:00:00Z',
    created_at: '2026-10-14T10:00:00Z',
  },
];

describe('InteractivePostsList', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    editContext.isAdmin = false;
    window.history.replaceState({}, '', '/news');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders published posts titles, excerpts, and links', async () => {
    await act(async () => {
      root.render(<InteractivePostsList initialPosts={SAMPLE_POSTS} />);
    });

    expect(container.textContent).toContain('Why Fair Oaks Needs Strong Public Schools');
    expect(container.textContent).toContain('A deep look at local school board policies');
    expect(container.textContent).toContain('Mobilizing Carmichael');
    expect(container.textContent).toContain('Lead story');

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));
    const schoolLink = links.find((l) => l.getAttribute('href') === '/fair-oaks-public-schools');
    expect(schoolLink).toBeDefined();

    const submitNews = links.find((l) =>
      l
        .getAttribute('href')
        ?.startsWith('mailto:contact@indivisiblefairoaks.org?subject=Chapter%20news%20submission')
    );
    expect(submitNews).toBeDefined();
    expect(submitNews?.textContent).toContain('Submit chapter news');
  });

  it('gives admins one clear Add News action into the block editor', async () => {
    editContext.isAdmin = true;
    await act(async () => {
      root.render(<InteractivePostsList initialPosts={SAMPLE_POSTS} />);
    });

    const addNews = Array.from(container.querySelectorAll<HTMLAnchorElement>('a')).find(
      (link) => link.getAttribute('href') === '/admin/content/new?type=post'
    );
    expect(addNews).toBeDefined();
    expect(addNews?.textContent).toContain('Add News');

    const guide = Array.from(container.querySelectorAll<HTMLAnchorElement>('a')).find(
      (link) => link.getAttribute('href') === '/admin/news#news-publishing-guide'
    );
    expect(guide).toBeDefined();
    expect(guide?.textContent).toContain('How to publish');
  });

  it('searches title and excerpt with normalized multi-word queries', async () => {
    await act(async () => {
      root.render(<InteractivePostsList initialPosts={SAMPLE_POSTS} />);
    });

    const search = container.querySelector<HTMLInputElement>('[data-testid="news-search"]');
    if (!search) throw new Error('news search did not render');

    await act(async () => {
      setInputValue(search, 'schools funding');
    });

    expect(container.textContent).toContain('1 story matching');
    expect(container.textContent).toContain('Use “quotes” around a phrase');
    expect(container.textContent).toContain('Why Fair Oaks Needs Strong Public Schools');
    expect(container.textContent).not.toContain('Mobilizing Carmichael');
    expect(
      [...container.querySelectorAll('mark')].some((mark) => mark.textContent === 'Schools')
    ).toBe(true);

    await act(async () => {
      setInputValue(search, 'not-a-real-story');
    });

    expect(container.textContent).toContain('No published stories match');
    const clear = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      /clear search/i.test(button.textContent ?? '')
    );
    expect(clear).not.toBeUndefined();
    await act(async () => {
      clear?.click();
    });

    expect(container.textContent).toContain('Mobilizing Carmichael');
    expect(new URLSearchParams(window.location.search).get('q')).toBeNull();
  });

  it('restores a shared search and follows back/forward URL changes', async () => {
    window.history.replaceState(
      {},
      '',
      `/news?${new URLSearchParams({ ref: 'footer', q: 'public schools' }).toString()}#latest-news`
    );

    await act(async () => {
      root.render(<InteractivePostsList initialPosts={SAMPLE_POSTS} />);
    });

    const search = container.querySelector<HTMLInputElement>('[data-testid="news-search"]');
    if (!search) throw new Error('news search did not render');
    expect(search.value).toBe('public schools');
    expect(container.textContent).toContain('1 story matching');

    await act(async () => {
      setInputValue(search, 'carmichael');
    });
    const updated = new URLSearchParams(window.location.search);
    expect(updated.get('q')).toBe('carmichael');
    expect(updated.get('ref')).toBe('footer');
    expect(window.location.hash).toBe('#latest-news');

    await act(async () => {
      window.history.pushState(
        {},
        '',
        `/news?${new URLSearchParams({ q: 'public schools' }).toString()}`
      );
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(search.value).toBe('public schools');
    expect(container.textContent).toContain('Why Fair Oaks Needs Strong Public Schools');
    expect(container.textContent).not.toContain('Mobilizing Carmichael');
  });

  it('loads older stories and searches beyond the first eleven posts', async () => {
    const posts: PublishedPostSummary[] = Array.from({ length: 13 }, (_, index) => ({
      id: 200 + index,
      title: index === 12 ? 'Thirteenth District Report' : `Chapter Story ${index + 1}`,
      slug: `chapter-story-${index + 1}`,
      excerpt: `Dispatch number ${index + 1} from the chapter.`,
      featured_image: null,
      published_at: `2026-09-${String(20 - index).padStart(2, '0')}T12:00:00Z`,
      created_at: `2026-09-${String(20 - index).padStart(2, '0')}T10:00:00Z`,
    }));

    await act(async () => {
      root.render(<InteractivePostsList initialPosts={posts} />);
    });

    expect(container.querySelectorAll('#news-results article')).toHaveLength(11);
    expect(container.textContent).not.toContain('Thirteenth District Report');
    expect(container.textContent).toContain('Showing 11 of 13 published stories');

    const search = container.querySelector<HTMLInputElement>('[data-testid="news-search"]');
    if (!search) throw new Error('news search did not render');

    // The old post is not visible in the browse list, but search must find it
    // because the page now holds the complete published archive.
    await act(async () => {
      setInputValue(search, 'Thirteenth');
    });
    expect(container.textContent).toContain('1 story matching');
    expect(container.textContent).toContain('Thirteenth District Report');

    await act(async () => {
      setInputValue(search, '');
    });

    const loadMore = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      /load older stories/i.test(button.textContent ?? '')
    );
    expect(loadMore).not.toBeUndefined();

    await act(async () => {
      loadMore?.click();
    });

    expect(container.querySelectorAll('#news-results article')).toHaveLength(13);
    expect(container.textContent).toContain('Thirteenth District Report');
    expect(container.textContent).toContain('Showing 13 of 13 published stories');
    expect(
      [...container.querySelectorAll<HTMLButtonElement>('button')].some((button) =>
        /load older stories/i.test(button.textContent ?? '')
      )
    ).toBe(false);
  });

  it('treats a whitespace-only query as no filter instead of cropping excerpts', async () => {
    await act(async () => {
      root.render(<InteractivePostsList initialPosts={SAMPLE_POSTS} />);
    });

    const search = container.querySelector<HTMLInputElement>('[data-testid="news-search"]');
    if (!search) throw new Error('news search did not render');

    await act(async () => {
      setInputValue(search, '   ');
    });

    expect(container.textContent).toContain('Why Fair Oaks Needs Strong Public Schools');
    expect(container.textContent).toContain('Mobilizing Carmichael');
    expect(container.textContent).not.toContain('matching');
    expect(container.textContent).toContain('A deep look at local school board policies');
  });

  it('renders empty state when no posts are provided', async () => {
    await act(async () => {
      root.render(<InteractivePostsList initialPosts={[]} />);
    });

    expect(container.textContent).toContain('No published articles yet');
  });
});
