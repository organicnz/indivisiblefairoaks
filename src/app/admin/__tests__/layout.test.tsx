// @vitest-environment node

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_AUDIT_LOSS_COOKIE } from '@/lib/admin-audit-alert';

const requireAdminPage = vi.hoisted(() => vi.fn());
const cookies = vi.hoisted(() => vi.fn());

vi.mock('@/lib/admin-auth', () => ({ requireAdminPage }));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('@/app/admin/actions', () => ({ acknowledgeAdminAuditLoss: vi.fn() }));

const { default: AdminLayout } = await import('@/app/admin/layout');

function cookieStore(entries: Record<string, string>) {
  return {
    get: (name: string) => (name in entries ? { name, value: entries[name] } : undefined),
  };
}

async function renderLayout(entries: Record<string, string> = {}) {
  cookies.mockResolvedValue(cookieStore(entries));
  return renderToStaticMarkup(await AdminLayout({ children: <p>Admin page body</p> }));
}

describe('AdminLayout audit loss warning', () => {
  beforeEach(() => {
    requireAdminPage.mockResolvedValue(undefined);
  });

  it('renders the warning banner with the cookie timestamp', async () => {
    const html = await renderLayout({
      [ADMIN_AUDIT_LOSS_COOKIE]: '2026-11-20T12:00:00.000Z',
    });

    expect(html).toContain('role="alert"');
    expect(html).toContain('Audit trail incomplete');
    expect(html).toContain('2026-11-20 12:00 UTC');
    expect(html).toContain('href="/admin/audit"');
    expect(html).toContain('href="/admin/audit/outbox"');
  });

  it('does not render the warning banner without the cookie', async () => {
    const html = await renderLayout();

    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('Audit trail incomplete');
  });
});
