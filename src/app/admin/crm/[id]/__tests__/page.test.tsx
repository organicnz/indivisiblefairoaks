// @vitest-environment node

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminPage = vi.hoisted(() => vi.fn());
const getCRMContactDetail = vi.hoisted(() => vi.fn());
const getAdminAuditContactBulkChanges = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  })
);

vi.mock('@/lib/admin-auth', () => ({ requireAdminPage }));
vi.mock('@/lib/actions/crm', () => ({ getCRMContactDetail }));
vi.mock('@/lib/admin-audit-read', () => ({
  ADMIN_AUDIT_CONTACT_BULK_PAGE_SIZE: 10,
  getAdminAuditContactBulkChanges,
}));
vi.mock('next/navigation', () => ({ notFound }));
vi.mock('@/components/admin/crm/CRMDetailClient', () => ({
  CRMDetailClient: () => <div data-testid="detail">Contact detail</div>,
}));
vi.mock('@/components/admin/crm/CRMContactBulkChangesPanel', () => ({
  CRMContactBulkChangesPanel: (props: {
    changes: unknown[];
    page: number;
    totalCount: number;
    unavailable: boolean;
    activityPage: number;
  }) => (
    <div
      data-testid="bulk-panel"
      data-page={props.page}
      data-total={props.totalCount}
      data-unavailable={String(props.unavailable)}
      data-activity-page={props.activityPage}
    >
      {props.changes.length} changes
    </div>
  ),
}));

const { default: AdminCRMDetailPage } = await import('@/app/admin/crm/[id]/page');

const CONTACT_ID = '33333333-3333-4333-8333-333333333333';
const adminClient = { from: vi.fn() };

const detail = {
  contact: {
    id: CONTACT_ID,
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.org',
  },
  activities: [],
  tasks: [],
  activityPage: 3,
  activityPageSize: 50,
  activityCount: 120,
  tasksTruncated: false,
  taskCount: 4,
  openTaskCount: 2,
};

const bulkRow = {
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
  before: null,
  after: null,
  metadata: {},
};

describe('AdminCRMDetailPage bulk history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPage.mockResolvedValue({ adminClient });
    getCRMContactDetail.mockResolvedValue(detail);
    getAdminAuditContactBulkChanges.mockResolvedValue({
      rows: [bulkRow, bulkRow, bulkRow],
      totalCount: 13,
    });
  });

  it('reads the bulk page separately and passes it to the panel', async () => {
    const html = renderToStaticMarkup(
      await AdminCRMDetailPage({
        params: Promise.resolve({ id: CONTACT_ID }),
        searchParams: Promise.resolve({ page: '3', bulkPage: '2' }),
      })
    );

    expect(getCRMContactDetail).toHaveBeenCalledWith(CONTACT_ID, 3);
    expect(getAdminAuditContactBulkChanges).toHaveBeenCalledWith(adminClient, CONTACT_ID, 2);
    expect(html).toContain('data-page="2"');
    expect(html).toContain('data-total="13"');
    expect(html).toContain('data-unavailable="false"');
    expect(html).toContain('data-activity-page="3"');
    expect(html).toContain('3 changes');
  });

  it('keeps the contact profile when the audit read fails', async () => {
    getAdminAuditContactBulkChanges.mockRejectedValue(new Error('audit unavailable'));

    const html = renderToStaticMarkup(
      await AdminCRMDetailPage({
        params: Promise.resolve({ id: CONTACT_ID }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(notFound).not.toHaveBeenCalled();
    expect(html).toContain('Contact detail');
    expect(html).toContain('data-unavailable="true"');
    expect(html).toContain('0 changes');
    expect(html).toContain('data-page="1"');
  });
});
