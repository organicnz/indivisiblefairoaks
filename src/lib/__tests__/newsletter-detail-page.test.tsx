// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NewsletterDetailPage, { generateMetadata } from '@/app/newsletters/[slug]/page';
import { getNewsletterBySlug } from '@/lib/queries/civic';

vi.mock('@/lib/queries/civic', () => ({
  getNewsletterBySlug: vi.fn(),
}));

const bulletin = {
  slug: 'summer-action-bulletin-2026',
  title: 'Summer Action Bulletin',
  date_label: 'July 2026',
  description: 'Summer organizing priorities for the chapter.',
  body: 'First paragraph of the full issue.\n\nSecond paragraph with the action list.',
  pdf_url: 'https://example.org/summer-bulletin.pdf',
  archive_url: 'https://example.org/archive/summer-bulletin',
  topics: ['Election Defense', 'Choir Actions'],
  sort_order: 10,
  published_at: '2026-07-01T00:00:00Z',
};

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('NewsletterDetailPage', () => {
  let container: HTMLDivElement;
  let root: Root;
  const getBulletin = vi.mocked(getNewsletterBySlug);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    getBulletin.mockResolvedValue(bulletin);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    getBulletin.mockReset();
  });

  it('renders the full issue and durable PDF/archive links', async () => {
    const page = await NewsletterDetailPage({
      params: Promise.resolve({ slug: bulletin.slug }),
    });
    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain('Summer Action Bulletin');
    expect(container.textContent).toContain('First paragraph of the full issue.');
    expect(container.textContent).toContain('Second paragraph with the action list.');
    expect(container.textContent).toContain('Download PDF');
    expect(container.textContent).toContain('Open archive');

    const pdf = container.querySelector<HTMLAnchorElement>(
      'a[href="https://example.org/summer-bulletin.pdf"]'
    );
    expect(pdf?.target).toBe('_blank');
    expect(pdf?.rel).toContain('noopener');
    expect(
      container.querySelector<HTMLAnchorElement>(
        'a[href="https://example.org/archive/summer-bulletin"]'
      )
    ).not.toBeNull();

    const archiveLinks = [
      ...container.querySelectorAll<HTMLAnchorElement>('a[href="/newsletters"]'),
    ];
    expect(archiveLinks.length).toBeGreaterThanOrEqual(2);
  });

  it('publishes canonical article metadata for the detail route', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: bulletin.slug }),
    });

    expect(metadata.title).toBe(bulletin.title);
    expect(metadata.alternates?.canonical?.toString()).toContain(`/newsletters/${bulletin.slug}`);
    expect(metadata.openGraph?.url?.toString()).toContain(`/newsletters/${bulletin.slug}`);
  });
});
