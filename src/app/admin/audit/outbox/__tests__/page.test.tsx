// @vitest-environment node

import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminPage = vi.hoisted(() => vi.fn());
const getAdminAuditOutboxHealth = vi.hoisted(() => vi.fn());

vi.mock('@/lib/admin-auth', () => ({ requireAdminPage }));
vi.mock('@/lib/admin-audit-outbox', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin-audit-outbox')>();
  return { ...actual, getAdminAuditOutboxHealth };
});
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const { default: AdminAuditOutboxPage } = await import('@/app/admin/audit/outbox/page');

const adminClient = { from: vi.fn() };

const health = {
  rows: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      created_at: '2026-11-20T11:30:00.000Z',
      attempts: 3,
      next_attempt_at: '2026-11-20T11:40:00.000Z',
      last_error: 'audit log constraint rejected the row',
      action: 'crm.contact.delete',
      target_type: 'crm_contact',
      target_id: 'contact-1',
      target_label: 'Robin',
      outcome: 'success',
      actor_email: 'organizer@example.org',
    },
  ],
  totalCount: 1,
  overdueCount: 1,
  failingCount: 1,
  severity: 'critical' as const,
  checkedAt: '2026-11-20T12:00:00.000Z',
};

describe('AdminAuditOutboxPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPage.mockResolvedValue({ adminClient });
    getAdminAuditOutboxHealth.mockResolvedValue(health);
  });

  it('requires the admin gate and renders the failing record with its retry state', async () => {
    const html = renderToStaticMarkup(await AdminAuditOutboxPage());

    expect(requireAdminPage).toHaveBeenCalledWith('/admin/audit/outbox');
    expect(getAdminAuditOutboxHealth).toHaveBeenCalledWith(adminClient);
    expect(html).toContain('Audit outbox health');
    expect(html).toContain('Delivery is failing repeatedly');
    expect(html).toContain('Contact deleted');
    expect(html).toContain('Robin');
    expect(html).toContain('organizer@example.org');
    expect(html).toContain('audit log constraint rejected the row');
    expect(html).toContain('Overdue');
    expect(html).toContain('Repeatedly failing');
    expect(html).toContain('href="/admin/audit"');
  });

  it('shows an empty healthy outbox without pretending it is a failure', async () => {
    getAdminAuditOutboxHealth.mockResolvedValue({
      rows: [],
      totalCount: 0,
      overdueCount: 0,
      failingCount: 0,
      severity: 'healthy',
      checkedAt: '2026-11-20T12:00:00.000Z',
    });

    const html = renderToStaticMarkup(await AdminAuditOutboxPage());

    expect(html).toContain('The outbox is healthy');
    expect(html).toContain('No audit records are waiting to be delivered');
    expect(html).not.toContain('Delivery is failing repeatedly');
  });

  it('reports an unreadable outbox instead of rendering an empty queue', async () => {
    getAdminAuditOutboxHealth.mockRejectedValue(new Error('outbox offline'));

    const html = renderToStaticMarkup(await AdminAuditOutboxPage());

    expect(html).toContain('Audit outbox health could not be checked');
    expect(html).toContain('The audit log may be behind');
    expect(html).not.toContain('No audit records are waiting to be delivered');
  });
});
