// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminNewsPage from '@/app/admin/news/page';

vi.mock('@/lib/admin-auth', () => ({
  requireAdminPage: vi.fn(async () => undefined),
}));

vi.mock('@/components/admin/civic/CivicNewsletterManager', () => ({
  CivicNewsletterManager: () => <div data-testid="newsletter-manager" />,
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('AdminNewsPage publishing guide', () => {
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

  it('explains both publishing paths and links to them', async () => {
    const page = await AdminNewsPage();
    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain('How to publish news');
    expect(container.textContent).toContain('Add a news post');
    expect(container.textContent).toContain('Publish a bulletin');
    expect(container.textContent).toContain('Step-by-step checklist');

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));
    const addNewsLinks = links.filter(
      (link) => link.getAttribute('href') === '/admin/content/new?type=post'
    );
    expect(addNewsLinks.length).toBeGreaterThanOrEqual(2);
    expect(addNewsLinks.some((link) => link.textContent?.includes('Add News'))).toBe(true);
    expect(
      links.find((link) => link.getAttribute('href') === '#bulletin-manager')
    ).toBeDefined();
    expect(container.querySelector('#bulletin-manager')).not.toBeNull();
  });
});
