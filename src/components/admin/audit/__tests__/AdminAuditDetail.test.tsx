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

const CONTACT_1 = '33333333-3333-4333-8333-333333333333';
const CONTACT_2 = '44444444-4444-4444-8444-444444444444';
const CONTACT_3 = '55555555-5555-4555-8555-555555555555';

const operation = {
  id: '11111111-1111-4111-8111-111111111111',
  created_at: '2026-11-19T14:30:00.000Z',
  actor_user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  actor_email: 'organizer@example.org',
  action: 'crm.contact.bulk_update',
  target_type: 'crm_contact',
  target_id: 'bulk-update',
  target_label: '3 selected contacts',
  mfa_level: 'aal2',
  outcome: 'success',
  error: null,
  before: {
    contact_ids: [CONTACT_1, CONTACT_2],
    contacts: [
      { id: CONTACT_1, status: 'supporter', tags: ['volunteer'] },
      { id: CONTACT_2, status: 'supporter', tags: ['volunteer'] },
    ],
  },
  after: {
    contact_ids: [CONTACT_1, CONTACT_2],
    contacts: [
      { id: CONTACT_1, status: 'active_volunteer', tags: ['volunteer', 'choir'] },
      { id: CONTACT_2, status: 'supporter', tags: ['volunteer'] },
    ],
  },
  metadata: {
    requested_count: 3,
    requested_ids: [CONTACT_1, CONTACT_2, CONTACT_3],
    affected_count: 2,
    affected_ids: [CONTACT_1, CONTACT_2],
    updated_count: 2,
    changed_fields: ['status', 'tags'],
  },
};

describe('AdminAuditDetail', () => {
  it('renders the operation, snapshots and read-only framing', () => {
    const html = renderToStaticMarkup(<AdminAuditDetail operation={operation} />);

    expect(html).toContain('Bulk contacts updated');
    expect(html).toContain('3 selected contacts');
    expect(html).toContain('organizer@example.org');
    expect(html).toContain('Read-only audit record');
    expect(html).toContain('append-only');
    expect(html).toContain('Bulk operation evidence');
    expect(html).toContain('Requested');
    expect(html).toContain('Affected');
    expect(html).toContain('Updated');
    expect(html).toContain('Not affected');
    expect(html).toContain('Per-contact before / after');
    expect(html).toContain('Status');
    expect(html).toContain('Active Volunteer');
    expect(html).toContain('#choir');
    expect(html).toContain('Raw JSON fallback');
    expect(html).toContain('supporter');
    expect(html).toContain('active_volunteer');
    expect(html).toContain('requested_count');
  });

  it('keeps the raw panels as the primary view for a non-bulk operation', () => {
    const html = renderToStaticMarkup(
      <AdminAuditDetail
        operation={{
          ...operation,
          action: 'content.publish',
          before: { published: false },
          after: { published: true },
          metadata: {},
        }}
      />
    );

    expect(html).toContain('Before');
    expect(html).toContain('After');
    expect(html).toContain('Metadata');
    expect(html).not.toContain('Bulk operation evidence');
    expect(html).not.toContain('Raw JSON fallback');
  });

  it('falls back to the raw JSON when no contact snapshots were recorded', () => {
    const html = renderToStaticMarkup(
      <AdminAuditDetail
        operation={{
          ...operation,
          before: null,
          after: null,
          metadata: {
            requested_count: 2,
            requested_ids: [CONTACT_1, CONTACT_2],
            updated_count: 0,
            changed_fields: ['status'],
          },
        }}
      />
    );

    expect(html).toContain('Bulk operation evidence');
    expect(html).toContain('No contact-level before/after snapshots were recorded');
    expect(html).toContain('Raw JSON fallback');
  });

  it('shows the correlated delivery status and provider events for a direct email', () => {
    const html = renderToStaticMarkup(
      <AdminAuditDetail
        operation={{
          ...operation,
          action: 'crm.direct_email.send',
          target_id: CONTACT_1,
          after: { resend_id: 'res_1', email: 'member@example.org', subject: 'Update' },
          metadata: { idempotency_key: '11111111-2222-4333-8444-555555555555' },
        }}
        delivery={{
          status: 'complained',
          acceptedAt: '2026-11-19T14:30:00.000Z',
          deliveredAt: '2026-11-19T14:31:00.000Z',
          bouncedAt: null,
          complainedAt: '2026-11-19T14:35:00.000Z',
          events: [
            { eventType: 'delivered', occurredAt: '2026-11-19T14:31:00.000Z' },
            { eventType: 'complained', occurredAt: '2026-11-19T14:35:00.000Z' },
          ],
        }}
      />
    );

    expect(html).toContain('Delivery status');
    expect(html).toContain('Current status');
    expect(html).toContain('Accepted');
    expect(html).toContain('Delivered');
    expect(html).toContain('Complained');
    expect(html).toContain('Accepted by Resend');
  });

  it('shows acceptance when Resend has no post-send event yet', () => {
    const html = renderToStaticMarkup(
      <AdminAuditDetail
        operation={{
          ...operation,
          action: 'crm.direct_email.send',
          target_id: CONTACT_1,
          after: { resend_id: 'res_pending' },
        }}
        delivery={{
          status: 'accepted',
          acceptedAt: '2026-11-19T14:30:00.000Z',
          deliveredAt: null,
          bouncedAt: null,
          complainedAt: null,
          events: [],
        }}
      />
    );

    expect(html).toContain('Current status: <strong>Accepted</strong>');
    expect(html).toContain('Accepted by Resend');
    expect(html).toContain('No delivery event has arrived yet');
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
