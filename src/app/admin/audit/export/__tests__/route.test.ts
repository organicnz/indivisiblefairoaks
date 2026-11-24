// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAdminClient } from '@/lib/__tests__/supabase-mock';
import { ADMIN_AUDIT_MAX_EXPORT_ROWS, EMPTY_ADMIN_AUDIT_FILTERS } from '@/lib/admin-audit-read';

const requireAdminApi = vi.hoisted(() => vi.fn());

vi.mock('@/lib/admin-api-auth', () => ({ requireAdminApi }));

const { GET } = await import('@/app/admin/audit/export/route');

const OPERATION_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_OPERATION_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ADMIN_EMAIL = 'organizer@example.org';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: OPERATION_ID,
    created_at: '2026-11-19T14:30:00.000Z',
    actor_user_id: ADMIN_USER_ID,
    actor_email: ADMIN_EMAIL,
    action: 'crm.contact.bulk_update',
    target_type: 'crm_contact',
    target_id: 'bulk-update',
    target_label: '2 selected contacts',
    mfa_level: 'aal2',
    outcome: 'success',
    error: null,
    before: null,
    after: null,
    metadata: { requested_count: 2 },
    ...overrides,
  };
}

function request(query = '') {
  return new Request(`https://example.org/admin/audit/export${query}`);
}

function successSession(adminClient: ReturnType<typeof createMockAdminClient>) {
  return {
    ok: true as const,
    session: {
      adminClient,
      adminUserId: ADMIN_USER_ID,
      adminEmail: ADMIN_EMAIL,
      mfaLevel: 'aal2' as const,
    },
  };
}

describe('GET /admin/audit/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the auth failure status without querying the audit log', async () => {
    requireAdminApi.mockResolvedValue({
      ok: false,
      status: 401,
      error: 'Unauthenticated',
    });

    const response = await GET(request());

    expect(response.status).toBe(401);
    await expect(response.text()).resolves.toBe('Unauthenticated');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('exports only rows matching the URL filters and records the export', async () => {
    const auditRows: Record<string, unknown>[] = [
      row(),
      row({
        id: OTHER_OPERATION_ID,
        created_at: '2026-11-19T13:00:00.000Z',
        action: 'content.publish',
        target_type: 'content',
        target_id: 'a-page',
        target_label: 'A page',
      }),
    ];
    const client = createMockAdminClient({ admin_audit_log: { rows: auditRows } });
    requireAdminApi.mockResolvedValue(successSession(client));

    const response = await GET(request('?action=content.publish'));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toMatch(
      /^attachment; filename="admin-audit-\d{4}-\d{2}-\d{2}\.csv"$/
    );
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(text).toContain('Content published');
    expect(text).toContain('a-page');
    expect(text).not.toContain('Contacts bulk updated');

    expect(auditRows).toHaveLength(3);
    expect(auditRows[2]).toMatchObject({
      actor_user_id: ADMIN_USER_ID,
      actor_email: ADMIN_EMAIL,
      action: 'admin.audit.export',
      target_type: 'admin_audit',
      target_id: 'admin-audit-export',
      target_label: 'Audit log CSV export',
      mfa_level: 'aal2',
      outcome: 'success',
      error: null,
      metadata: {
        format: 'csv',
        filters: { ...EMPTY_ADMIN_AUDIT_FILTERS, action: 'content.publish' },
        row_count: 1,
        operation_ids: [OTHER_OPERATION_ID],
      },
    });
  });

  it('records a refused oversized export as a failure', async () => {
    const auditRows: Record<string, unknown>[] = [];
    const client = createMockAdminClient({
      admin_audit_log: { rows: auditRows, count: ADMIN_AUDIT_MAX_EXPORT_ROWS + 1 },
    });
    requireAdminApi.mockResolvedValue(successSession(client));

    const response = await GET(request());

    expect(response.status).toBe(413);
    await expect(response.text()).resolves.toContain('Narrow the filters');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      action: 'admin.audit.export',
      target_type: 'admin_audit',
      outcome: 'failure',
      metadata: {
        format: 'csv',
        filters: EMPTY_ADMIN_AUDIT_FILTERS,
        row_count: 0,
        operation_ids: [],
        matched_count: ADMIN_AUDIT_MAX_EXPORT_ROWS + 1,
        reason: 'row_cap',
      },
    });
    expect(auditRows[0]?.error).toContain('Narrow the filters');
  });

  it('releases the CSV when the audit record is durably queued', async () => {
    const auditRows: Record<string, unknown>[] = [row()];
    const outboxRows: Record<string, unknown>[] = [];
    const client = createMockAdminClient({
      admin_audit_log: {
        rows: auditRows,
        insertError: { message: 'audit table offline' },
      },
      admin_audit_outbox: { rows: outboxRows },
    });
    requireAdminApi.mockResolvedValue(successSession(client));

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(outboxRows).toHaveLength(1);
    expect(outboxRows[0]?.payload).toMatchObject({
      action: 'admin.audit.export',
      metadata: { row_count: 1, operation_ids: [OPERATION_ID] },
    });
  });

  it('withholds the CSV when the audit record cannot be written or queued', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = createMockAdminClient({
      admin_audit_log: {
        rows: [row()],
        insertError: { message: 'audit table offline' },
      },
      admin_audit_outbox: {
        insertError: { message: 'outbox offline' },
      },
    });
    requireAdminApi.mockResolvedValue(successSession(client));

    const response = await GET(request());
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).toContain('could not be recorded');
    expect(text).not.toContain('crm.contact.bulk_update');
    expect(consoleError).toHaveBeenCalledWith(
      '[admin-audit] write failed',
      expect.objectContaining({ action: 'admin.audit.export', queued: false })
    );
  });
});
