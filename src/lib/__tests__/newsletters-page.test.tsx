// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NewslettersPage, { metadata } from '@/app/newsletters/page';

vi.mock('@/lib/queries/civic', () => ({
  getDataPoints: vi.fn(async () => ({})),
  getNewsletters: vi.fn(async () => []),
}));

vi.mock('@/lib/queries/legacy', () => ({
  getLegacyDocuments: vi.fn(async () => []),
}));

vi.mock('@/components/ui/ActionAlertsSubscription', () => ({
  ActionAlertsSubscription: () => <div data-testid="subscribe-panel" />,
}));

vi.mock('@/components/ui/InteractiveNewslettersList', () => ({
  InteractiveNewslettersList: ({
    initialNewsletters,
  }: {
    initialNewsletters?: unknown[];
  }) => (
    <div
      data-testid="newsletter-list"
      data-initial-count={initialNewsletters?.length ?? 0}
    />
  ),
}));

vi.mock('@/components/archive/LegacyDocumentArchive', () => ({
  LegacyDocumentArchive: () => <div data-testid="legacy-archive" />,
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('NewslettersPage', () => {
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

  it('exports metadata for the dedicated route', () => {
    expect(metadata.title).toBe('Newsletters & Chapter Updates');
    expect(metadata.alternates?.canonical?.toString()).toContain('/newsletters');
  });

  it('renders the verified neighboring chapter card without calling it a newsletter', async () => {
    const page = await NewslettersPage();
    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain('From our neighbors');
    expect(container.textContent).toContain('Indivisible Citrus Heights');
    expect(container.textContent).toContain('No public newsletter archive listed');

    const sourceLink = Array.from(container.querySelectorAll<HTMLAnchorElement>('a')).find(
      (link) => link.href === 'https://indivisible.org/events/indivisible-citrus-heights/'
    );
    expect(sourceLink).toBeDefined();
    expect(sourceLink?.target).toBe('_blank');
    expect(sourceLink?.rel).toContain('noopener');
  });

  it('renders the newsletter archive and a route back to News & Updates', async () => {
    const page = await NewslettersPage();
    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain('Newsletters & Chapter Updates');
    expect(container.textContent).toContain('Past Bulletins & Archives');
    expect(container.querySelector('[data-testid="subscribe-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="newsletter-list"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="legacy-archive"]')).toBeNull();

    const newsLink = Array.from(container.querySelectorAll<HTMLAnchorElement>('a')).find(
      (link) => link.getAttribute('href') === '/news'
    );
    expect(newsLink).toBeDefined();
    expect(newsLink?.textContent).toContain('News & updates');
  });
});
