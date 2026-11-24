// @vitest-environment node

import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AdminAuditOperation } from '@/lib/admin-audit-read';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const { CRMContactBulkChangesPanel } = await import(
  '@/components/admin/crm/CRMContactBulkChangesPanel'
);

const CONTACT_ID = '33333333-3333-4333-8333-333333333333';
const OPERATION_ID = '11111111-1111-4111-8111-111111111111';

function bulkUpdate(overrides: Partial<AdminAuditOperation> = {}): AdminAuditOperation {
  return {
    id: OPERATION_ID,
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
    before: {
      contact_ids: [CONTACT_ID],
      contacts: [
        {
          id: CONTACT_ID,
          status: 'supporter',
          district: 'CA-06',
          tags: ['volunteer'],
          do_not_email: false,
        },
      ],
    },
    after: {
      contact_ids: [CONTACT_ID],
      contacts: [
        {
          id: CONTACT_ID,
          status: 'active_volunteer',
          district: 'CA-06',
          tags: ['volunteer', 'choir'],
          do_not_email: true,
        },
      ],
    },
    metadata: {
      requested_ids: [CONTACT_ID],
      affected_ids: [CONTACT_ID],
      changed_fields: ['status', 'tags', 'consent'],
      requested_count: 2,
      affected_count: 1,
    },
    ...overrides,
  };
}

describe('CRMContactBulkChangesPanel', () => {
  it('shows this contact field changes and preserves the timeline page in pager links', () => {
    const html = renderToStaticMarkup(
      <CRMContactBulkChangesPanel
        contactId={CONTACT_ID}
        changes={[bulkUpdate()]}
        page={1}
        pageSize={10}
        totalCount={12}
        unavailable={false}
        activityPage={2}
      />
    );

    expect(html).toContain('Bulk change history');
    expect(html).toContain('2 selected · 1 affected.');
    expect(html).toContain('This constituent was changed.');
    expect(html).toContain('Status:');
    expect(html).toContain('Supporter → Active Volunteer');
    expect(html).toContain('Tags:');
    expect(html).toContain('+#choir');
    expect(html).toContain('Email consent:');
    expect(html).toContain('Opted in → Opted out');
    expect(html).toContain(`href="/admin/audit?contact=${CONTACT_ID}"`);
    expect(html).toContain('Showing');
    expect(html).toContain('1–10');
    expect(html).toContain('bulkPage=2');
    expect(html).toContain('page=2');
    expect(html).toContain('Bulk change history pages');
  });

  it('does not claim a changed contact when the contact was only requested', () => {
    const html = renderToStaticMarkup(
      <CRMContactBulkChangesPanel
        contactId={CONTACT_ID}
        changes={[
          bulkUpdate({
            metadata: {
              requested_ids: [CONTACT_ID],
              affected_ids: [],
              changed_fields: ['status'],
              requested_count: 2,
              affected_count: 0,
            },
          }),
        ]}
        page={1}
        pageSize={10}
        totalCount={1}
        unavailable={false}
        activityPage={1}
      />
    );

    expect(html).toContain('This constituent was selected but no change was recorded.');
    expect(html).not.toContain('This constituent was changed.');
  });

  it('does not call a matched update changed when its snapshots are identical', () => {
    const unchangedSnapshot = {
      contact_ids: [CONTACT_ID],
      contacts: [
        {
          id: CONTACT_ID,
          status: 'supporter',
          district: 'CA-06',
          tags: ['volunteer'],
          do_not_email: false,
        },
      ],
    };
    const html = renderToStaticMarkup(
      <CRMContactBulkChangesPanel
        contactId={CONTACT_ID}
        changes={[
          bulkUpdate({
            before: unchangedSnapshot,
            after: unchangedSnapshot,
            metadata: {
              requested_ids: [CONTACT_ID],
              affected_ids: [CONTACT_ID],
              changed_fields: ['status', 'tags', 'consent'],
              requested_count: 1,
              affected_count: 1,
            },
          }),
        ]}
        page={1}
        pageSize={10}
        totalCount={1}
        unavailable={false}
        activityPage={1}
      />
    );

    expect(html).toContain('This constituent was selected but no change was recorded.');
    expect(html).not.toContain('This constituent was changed.');
  });

  it('offers the first page when the requested page is past the end', () => {
    const html = renderToStaticMarkup(
      <CRMContactBulkChangesPanel
        contactId={CONTACT_ID}
        changes={[]}
        page={3}
        pageSize={10}
        totalCount={12}
        unavailable={false}
        activityPage={2}
      />
    );

    expect(html).toContain('That page is out of range.');
    expect(html).toContain(`href="/admin/crm/${CONTACT_ID}?page=2"`);
    expect(html).not.toContain('Showing');
  });

  it('reports an unreadable audit log instead of an empty history', () => {
    const html = renderToStaticMarkup(
      <CRMContactBulkChangesPanel
        contactId={CONTACT_ID}
        changes={[]}
        page={1}
        pageSize={10}
        totalCount={0}
        unavailable
        activityPage={1}
      />
    );

    expect(html).toContain('Bulk change history is temporarily unavailable.');
    expect(html).toContain('Bulk changes could not be loaded.');
    expect(html).not.toContain('0 bulk updates selected');
    expect(html).not.toContain('has not been included in a bulk update');
  });
});
