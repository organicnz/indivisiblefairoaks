// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InteractiveNewslettersList } from '@/components/ui/InteractiveNewslettersList';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockDataPoints = {
  dataPoints: {
    'news.empty.desc':
      'No chapter bulletins match your criteria. Try choosing “All Topics” or searching for another civic keyword.',
  } as Record<string, string>,
  get: (_key: string, fallback = '') => fallback,
  loading: false,
  refresh: vi.fn(),
};

const mockEditContext = vi.hoisted(() => ({ isAdmin: false }));

vi.mock('@/hooks/useDataPoints', () => ({
  useDataPoints: () => mockDataPoints,
}));

vi.mock('@/components/layout/useEditContext', () => ({
  useEditContext: () => ({
    isAdmin: mockEditContext.isAdmin,
    loading: false,
    target: null,
  }),
}));

vi.mock('@/lib/actions/civic', () => ({
  deleteCivicNewsletter: vi.fn(),
  saveCivicNewsletter: vi.fn(),
  getCivicNewslettersAdmin: vi.fn(),
}));

describe('InteractiveNewslettersList', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockEditContext.isAdmin = false;
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

  it('shows an honest empty archive rather than invented fallback bulletins', async () => {
    await act(async () => {
      root.render(<InteractiveNewslettersList initialNewsletters={[]} />);
    });

    expect(container.textContent).toContain('No chapter bulletins have been published yet');
    expect(container.textContent).not.toContain('Summer Action Bulletin');
    expect(container.textContent).not.toContain('Mid-Year Grassroots Review');
    // The seeded filter copy must not mask the archive-empty copy.
    expect(container.textContent).not.toContain('No chapter bulletins match your criteria');
  });

  it('shows the stored publication instant as Pacific wall time when an admin opens edit', async () => {
    mockEditContext.isAdmin = true;
    await act(async () => {
      root.render(
        <InteractiveNewslettersList
          initialNewsletters={[
            {
              slug: 'fall-bulletin',
              title: 'Fall Bulletin',
              date_label: 'October 2026',
              description: 'Fall organizing',
              topics: ['Elections'],
              sort_order: 10,
              published_at: '2026-10-01T00:00:00Z',
            },
          ]}
        />
      );
    });

    const edit = container.querySelector<HTMLButtonElement>('button[title="Edit this bulletin"]');
    expect(edit).not.toBeNull();
    await act(async () => {
      edit?.click();
    });

    const publishedAt = document.querySelector<HTMLInputElement>('#civic-news-published-at');
    expect(publishedAt?.value).toBe('2026-09-30T17:00');
  });
});
