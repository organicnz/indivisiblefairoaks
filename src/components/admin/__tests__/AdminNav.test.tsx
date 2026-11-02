// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminNav } from '@/components/admin/AdminNav';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
}));

vi.mock('@/hooks/useDataPoints', () => ({
  useDataPoints: () => ({
    dataPoints: {
      'admin.nav.dashboard': 'Dashboard',
      'admin.nav.content': 'Pages & Posts',
      'admin.nav.crm': 'Civic CRM',
      'admin.nav.products': 'Products',
      'admin.nav.customers': 'Customers',
    },
  }),
}));

vi.mock('@/components/layout/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

describe('AdminNav', () => {
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

  it('renders the admin navigation links', () => {
    act(() => {
      root.render(<AdminNav />);
    });

    const links = Array.from(container.querySelectorAll('a'));
    const hrefs = links.map((link) => link.getAttribute('href'));

    // Active links present
    expect(hrefs).toContain('/admin');
    expect(hrefs).toContain('/admin/content');
    expect(hrefs).toContain('/admin/events');
    expect(hrefs).toContain('/admin/news');
    expect(hrefs).toContain('/admin/links');
    expect(hrefs).toContain('/admin/crm');

    // Legacy commerce surfaces are gone, not merely hidden.
    expect(hrefs).not.toContain('/admin/products');
    expect(hrefs).not.toContain('/admin/customers');
    expect(hrefs).not.toContain('/admin/orders');
  });
});
