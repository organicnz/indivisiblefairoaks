// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InteractivePostsList } from '@/components/ui/InteractivePostsList';
import type { PublishedPostSummary } from '@/lib/queries/content';

const editContext = vi.hoisted(() => ({ isAdmin: false }));

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
  });

  it('renders empty state when no posts are provided', async () => {
    await act(async () => {
      root.render(<InteractivePostsList initialPosts={[]} />);
    });

    expect(container.textContent).toContain('No published articles yet');
  });
});
