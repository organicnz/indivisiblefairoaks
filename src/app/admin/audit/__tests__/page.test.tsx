// @vitest-environment node

import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_ADMIN_AUDIT_FILTERS } from '@/lib/admin-audit-read';

const requireAdminPage = vi.hoisted(() => vi.fn());
const getAdminAuditPage = vi.hoisted(() => vi.fn());

vi.mock('@/lib/admin-auth', () => ({ requireAdminPage }));
vi.mock('@/lib/admin-audit-read', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin-audit-read')>();
  return { ...actual, getAdminAuditPage };
});
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const { default: AdminAuditLogPage } = await import('@/app/admin/audit/page');

const adminClient = { from: vi.fn() };
const row = {
  id: '11111111-1111-4111-8111-111111111111',
  created_at: '2026-11-19T14:30:00.000Z',
  actor_user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  actor_email: 'organizer@example.org',
  action: 'crm.contact.bulk_update',
  target_type: 'crm_contact',
  target_id: 'bulk-update',
  target_label: '2 selected contacts',
  mfa_level: 'aal2',
  outcome: 'success',
  error: null,
};

describe('AdminAuditLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPage.mockResolvedValue({ adminClient });
    getAdminAuditPage.mockResolvedValue({ rows: [row], totalCount: 1 });
  });

  it('normalizes filters, preserves the page, and renders the operation', async () => {
    const html = renderToStaticMarkup(
      await AdminAuditLogPage({
        searchParams: Promise.resolve({
          actor: '  organizer@example.org  ',
          action: 'crm.contact.bulk_update',
          outcome: 'success',
          from: '2026-11-01',
          to: '2026-11-19',
          targetType: 'crm_contact',
          target: 'bulk-update',
          page: '2',
        }),
      })
    );

    expect(requireAdminPage).toHaveBeenCalledWith('/admin/audit');
    expect(getAdminAuditPage).toHaveBeenCalledWith(
      adminClient,
      {
        actor: 'organizer@example.org',
        action: 'crm.contact.bulk_update',
        outcome: 'success',
        from: '2026-11-01',
        to: '2026-11-19',
        targetType: 'crm_contact',
        target: 'bulk-update',
      },
      2
    );
    expect(html).toContain('Audit log');
    expect(html).toContain('Recorded operations');
    expect(html).toContain('Bulk contacts updated');
    expect(html).toContain('organizer@example.org');
  });

  it('passes empty normalized filters through when the query string is absent', async () => {
    renderToStaticMarkup(await AdminAuditLogPage({ searchParams: Promise.resolve({}) }));

    expect(getAdminAuditPage).toHaveBeenCalledWith(adminClient, EMPTY_ADMIN_AUDIT_FILTERS, 1);
  });
});
