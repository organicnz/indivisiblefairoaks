// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminNewsPage from '@/app/admin/news/page';
import type { ContentListRow } from '@/lib/actions/content';

vi.mock('@/lib/admin-auth', () => ({
  requireAdminPage: vi.fn(async () => undefined),
}));

const getContentList = vi.hoisted(() => vi.fn());
const getCivicNewslettersAdmin = vi.hoisted(() => vi.fn());

vi.mock('@/lib/actions/content', () => ({ getContentList }));
vi.mock('@/lib/actions/civic', () => ({ getCivicNewslettersAdmin }));

vi.mock('@/components/admin/civic/CivicNewsletterManager', () => ({
  CivicNewsletterManager: () => <div data-testid="newsletter-manager" />,
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function contentRow(overrides: Partial<ContentListRow>): ContentListRow {
  return {
    id: 7,
    title: 'Live Story',
    slug: 'live-story',
    excerpt: 'A published chapter update.',
    type: 'post',
    status: 'publish',
    published_at: '2026-01-01T00:00:00Z',
    featured_image: null,
    updated_at: '2026-01-02T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function emptyList() {
  return { rows: [], totalCount: 0, page: 1, pageSize: 6, hiddenCount: 0 };
}

describe('AdminNewsPage publishing guide', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getContentList.mockReset();
    getContentList.mockResolvedValue(emptyList());
    getCivicNewslettersAdmin.mockReset();
    getCivicNewslettersAdmin.mockResolvedValue({ success: true, data: [] });

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

  async function renderPage() {
    const page = await AdminNewsPage();
    await act(async () => {
      root.render(page);
    });
  }

  it('explains both publishing paths and links to them', async () => {
    await renderPage();

    expect(container.textContent).toContain('How to publish');
    expect(container.textContent).toContain('Add a news post');
    expect(container.textContent).toContain('Publish a bulletin');
    expect(container.textContent).toContain('Step-by-step checklist');
    expect(container.textContent).toContain('No news posts yet');

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));
    const addNewsLinks = links.filter(
      (link) => link.getAttribute('href') === '/admin/content/new?type=post'
    );
    expect(addNewsLinks.length).toBeGreaterThanOrEqual(2);
    expect(addNewsLinks.some((link) => link.textContent?.includes('Add News'))).toBe(true);
    expect(links.find((link) => link.getAttribute('href') === '#bulletin-manager')).toBeDefined();
    expect(container.querySelector('#bulletin-manager')).not.toBeNull();
  });

  it('shows published posts with Edit and View actions and drafts with Edit only', async () => {
    getContentList.mockResolvedValue({
      ...emptyList(),
      totalCount: 2,
      rows: [
        contentRow({}),
        contentRow({
          id: 8,
          title: 'Draft Story',
          slug: 'draft-story',
          status: 'draft',
          published_at: null,
        }),
      ],
    });

    await renderPage();

    expect(container.textContent).toContain('Recent news');
    expect(container.textContent).toContain('Live Story');
    expect(container.textContent).toContain('Draft Story');
    expect(container.textContent).toContain('Published');
    expect(container.textContent).toContain('Draft');

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));
    expect(links.some((link) => link.getAttribute('href') === '/admin/content/7')).toBe(true);
    expect(links.some((link) => link.getAttribute('href') === '/admin/content/8')).toBe(true);
    expect(links.some((link) => link.getAttribute('href') === '/live-story')).toBe(true);

    const viewLinks = links.filter((link) => link.textContent?.includes('View'));
    expect(viewLinks).toHaveLength(1);
  });

  it('labels a future post Scheduled and does not offer a public view link', async () => {
    getContentList.mockResolvedValue({
      ...emptyList(),
      totalCount: 1,
      rows: [
        contentRow({
          title: 'Future Story',
          slug: 'future-story',
          published_at: '2099-01-01T00:00:00Z',
        }),
      ],
    });

    await renderPage();

    expect(container.textContent).toContain('Scheduled');
    expect(
      Array.from(container.querySelectorAll<HTMLAnchorElement>('a')).some(
        (link) => link.getAttribute('href') === '/future-story'
      )
    ).toBe(false);
  });
});
