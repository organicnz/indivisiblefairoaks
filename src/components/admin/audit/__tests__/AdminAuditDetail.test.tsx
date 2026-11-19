// @vitest-environment node

import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AdminAuditDetail } from '@/components/admin/audit/AdminAuditDetail';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const operation = {
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
  before: { status: 'supporter' },
  after: { status: 'active_volunteer' },
  metadata: { requested_count: 2, updated_count: 2 },
};

describe('AdminAuditDetail', () => {
  it('renders the operation, snapshots and read-only framing', () => {
    const html = renderToStaticMarkup(<AdminAuditDetail operation={operation} />);

    expect(html).toContain('Bulk contacts updated');
    expect(html).toContain('2 selected contacts');
    expect(html).toContain('organizer@example.org');
    expect(html).toContain('Read-only audit record');
    expect(html).toContain('append-only');
    expect(html).toContain('supporter');
    expect(html).toContain('active_volunteer');
    expect(html).toContain('requested_count');
  });

  it('renders a recorded error instead of hiding it', () => {
    const html = renderToStaticMarkup(
      <AdminAuditDetail
        operation={{ ...operation, outcome: 'failure', error: 'database offline' }}
      />
    );

    expect(html).toContain('Failure');
    expect(html).toContain('database offline');
  });
});
