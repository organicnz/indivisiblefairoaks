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

describe('InteractiveNewslettersList', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockEditContext.isAdmin = false;
    window.history.replaceState({}, '', '/newsletters');
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

  it('searches titles, summaries and topics with normalized tokens and clears cleanly', async () => {
    await act(async () => {
      root.render(
        <InteractiveNewslettersList
          initialNewsletters={[
            {
              slug: 'fall-bulletin',
              title: 'Fall Bulletin',
              date_label: 'October 2026',
              description: 'Election defense across Sacramento County.',
              topics: ['Elections'],
              sort_order: 10,
              published_at: '2026-10-01T00:00:00Z',
            },
            {
              slug: 'choir-night',
              title: 'Choir Night',
              date_label: 'September 2026',
              description: 'Music and organizing in the park.',
              topics: ['Choir Actions'],
              sort_order: 20,
              published_at: '2026-09-01T00:00:00Z',
            },
          ]}
        />
      );
    });

    const search = container.querySelector<HTMLInputElement>('[data-testid="newsletter-search"]');
    if (!search) throw new Error('newsletter search did not render');

    await act(async () => {
      setInputValue(search, 'choir actions');
    });

    expect(container.textContent).toContain('Choir Night');
    expect(container.textContent).not.toContain('Fall Bulletin');
    expect(container.textContent).toContain('Showing 1 of 2 bulletins');
    expect(
      [...container.querySelectorAll('mark')].some((mark) => /choir/i.test(mark.textContent ?? ''))
    ).toBe(true);

    const clear = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Clear bulletin search"]'
    );
    expect(clear).not.toBeNull();
    await act(async () => {
      clear?.click();
    });

    expect(container.textContent).toContain('Fall Bulletin');
    expect(container.textContent).toContain('Choir Night');
    expect(new URLSearchParams(window.location.search).get('q')).toBeNull();
  });

  it('restores shared search and topic filters and follows back/forward changes', async () => {
    const newsletters = [
      {
        slug: 'fall-bulletin',
        title: 'Fall Bulletin',
        date_label: 'October 2026',
        description: 'Election defense across Sacramento County.',
        topics: ['Elections'],
        sort_order: 10,
        published_at: null,
      },
      {
        slug: 'choir-night',
        title: 'Choir Night',
        date_label: 'September 2026',
        description: 'Music and organizing in the park.',
        topics: ['Choir Actions'],
        sort_order: 20,
        published_at: null,
      },
    ];

    window.history.replaceState(
      {},
      '',
      `/newsletters?${new URLSearchParams({ q: 'choir', topic: 'Choir Actions' }).toString()}`
    );

    await act(async () => {
      root.render(<InteractiveNewslettersList initialNewsletters={newsletters} />);
    });

    const search = container.querySelector<HTMLInputElement>('[data-testid="newsletter-search"]');
    if (!search) throw new Error('newsletter search did not render');
    expect(search.value).toBe('choir');
    expect(
      [...container.querySelectorAll<HTMLButtonElement>('button')].some(
        (button) =>
          button.getAttribute('aria-pressed') === 'true' &&
          button.textContent?.trim().startsWith('Choir Actions')
      )
    ).toBe(true);
    expect(container.textContent).toContain('Choir Night');
    expect(container.textContent).not.toContain('Fall Bulletin');

    await act(async () => {
      setInputValue(search, 'fall');
    });
    expect(new URLSearchParams(window.location.search).get('q')).toBe('fall');

    const elections = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.trim().startsWith('Elections')
    );
    expect(elections).not.toBeUndefined();
    await act(async () => {
      elections?.click();
    });

    const params = new URLSearchParams(window.location.search);
    expect(params.get('q')).toBe('fall');
    expect(params.get('topic')).toBe('Elections');

    await act(async () => {
      window.history.pushState(
        {},
        '',
        `/newsletters?${new URLSearchParams({ q: 'choir', topic: 'Choir Actions' }).toString()}`
      );
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(search.value).toBe('choir');
    expect(container.textContent).toContain('Choir Night');
    expect(container.textContent).not.toContain('Fall Bulletin');

    const clear = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      /clear search and topic/i.test(button.textContent ?? '')
    );
    expect(clear).not.toBeUndefined();
    await act(async () => {
      clear?.click();
    });

    const cleared = new URLSearchParams(window.location.search);
    expect(cleared.get('q')).toBeNull();
    expect(cleared.get('topic')).toBeNull();
    expect(container.textContent).toContain('Fall Bulletin');
    expect(container.textContent).toContain('Choir Night');
  });

  it('opens the bulletin detail page and exposes durable PDF/archive links instead of email', async () => {
    await act(async () => {
      root.render(
        <InteractiveNewslettersList
          initialNewsletters={[
            {
              slug: 'fall-bulletin',
              title: 'Fall Bulletin',
              date_label: 'October 2026',
              description: 'Election defense across Sacramento County.',
              body: 'The full fall issue.',
              pdf_url: 'https://example.org/fall.pdf',
              archive_url: 'https://example.org/archive/fall',
              topics: ['Elections'],
              sort_order: 10,
              published_at: '2026-10-01T00:00:00Z',
            },
          ]}
        />
      );
    });

    const detailLinks = [
      ...container.querySelectorAll<HTMLAnchorElement>('a[href="/newsletters/fall-bulletin"]'),
    ];
    expect(detailLinks.length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).toContain('Read Full Issue');
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();

    const pdf = container.querySelector<HTMLAnchorElement>(
      'a[href="https://example.org/fall.pdf"]'
    );
    expect(pdf?.target).toBe('_blank');
    expect(pdf?.rel).toContain('noopener');
    expect(
      container.querySelector<HTMLAnchorElement>('a[href="https://example.org/archive/fall"]')
    ).not.toBeNull();
  });

  it('filters by a case-insensitive topic chip', async () => {
    await act(async () => {
      root.render(
        <InteractiveNewslettersList
          initialNewsletters={[
            {
              slug: 'fall-bulletin',
              title: 'Fall Bulletin',
              date_label: 'October 2026',
              description: 'Election defense.',
              topics: ['Elections'],
              sort_order: 10,
              published_at: null,
            },
            {
              slug: 'choir-night',
              title: 'Choir Night',
              date_label: 'September 2026',
              description: 'Music and organizing.',
              topics: ['Choir Actions'],
              sort_order: 20,
              published_at: null,
            },
          ]}
        />
      );
    });

    const topic = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.trim().startsWith('Choir Actions')
    );
    expect(topic).not.toBeUndefined();
    await act(async () => {
      topic?.click();
    });

    expect(container.textContent).toContain('Choir Night');
    expect(container.textContent).not.toContain('Fall Bulletin');
  });

  it('treats a whitespace-only query as the complete archive', async () => {
    await act(async () => {
      root.render(
        <InteractiveNewslettersList
          initialNewsletters={[
            {
              slug: 'fall-bulletin',
              title: 'Fall Bulletin',
              date_label: 'October 2026',
              description: 'Election defense.',
              topics: ['Elections'],
              sort_order: 10,
              published_at: null,
            },
            {
              slug: 'choir-night',
              title: 'Choir Night',
              date_label: 'September 2026',
              description: 'Music and organizing.',
              topics: ['Choir Actions'],
              sort_order: 20,
              published_at: null,
            },
          ]}
        />
      );
    });

    const search = container.querySelector<HTMLInputElement>('[data-testid="newsletter-search"]');
    if (!search) throw new Error('newsletter search did not render');

    await act(async () => {
      setInputValue(search, '   ');
    });

    expect(container.textContent).toContain('Fall Bulletin');
    expect(container.textContent).toContain('Choir Night');
    expect(container.textContent).not.toContain('Showing');
  });

  it('keeps every topic reachable and clears a topic from the result summary', async () => {
    const topicNames = ['Housing', 'Schools', 'Choir', 'Elections', 'Health', 'Climate', 'Food'];
    await act(async () => {
      root.render(
        <InteractiveNewslettersList
          initialNewsletters={topicNames.map((topic, index) => ({
            slug: topic.toLowerCase(),
            title: `${topic} Bulletin`,
            date_label: 'October 2026',
            description: `${topic} organizing update.`,
            topics: [topic],
            sort_order: index,
            published_at: null,
          }))}
        />
      );
    });

    const more = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      /more topics/i.test(button.textContent ?? '')
    );
    expect(more).not.toBeUndefined();
    await act(async () => {
      more?.click();
    });

    const climate = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.trim().startsWith('Climate')
    );
    expect(climate).not.toBeUndefined();
    await act(async () => {
      climate?.click();
    });

    expect(container.textContent).toContain('Climate Bulletin');
    expect(container.textContent).not.toContain('Housing Bulletin');
    expect(container.textContent).toContain('Show all topics');

    const reset = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === 'Show all topics'
    );
    await act(async () => {
      reset?.click();
    });

    expect(container.textContent).toContain('Housing Bulletin');
    expect(container.textContent).toContain('Climate Bulletin');
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
