// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InteractivePostsList } from '@/components/ui/InteractivePostsList';
import type { PublishedPostSummary } from '@/lib/queries/content';

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

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));
    const schoolLink = links.find((l) => l.getAttribute('href') === '/fair-oaks-public-schools');
    expect(schoolLink).toBeDefined();
  });

  it('renders empty state when no posts are provided', async () => {
    await act(async () => {
      root.render(<InteractivePostsList initialPosts={[]} />);
    });

    expect(container.textContent).toContain('No published articles yet');
  });
});
