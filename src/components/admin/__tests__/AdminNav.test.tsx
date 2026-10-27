// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminNav, LEGACY_ADMIN_ITEMS } from '@/components/admin/AdminNav';

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
      'admin.nav.orders': 'Orders',
      'admin.nav.products': 'Products',
      'admin.nav.customers': 'Customers',
      'admin.nav.coupons': 'Coupons',
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

  it('renders active admin navigation links and omits legacy orders', () => {
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
    expect(hrefs).toContain('/admin/products');
    expect(hrefs).toContain('/admin/customers');
    expect(hrefs).toContain('/admin/coupons');

    // Orders is hidden from active navigation
    expect(hrefs).not.toContain('/admin/orders');
  });

  it('exports LEGACY_ADMIN_ITEMS containing /admin/orders for reference', () => {
    expect(LEGACY_ADMIN_ITEMS.some((item) => item.href === '/admin/orders')).toBe(true);
  });
});
