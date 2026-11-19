// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAdminClient } from '@/lib/__tests__/supabase-mock';
import { ADMIN_AUDIT_MAX_EXPORT_ROWS } from '@/lib/admin-audit-read';

const requireAdminApi = vi.hoisted(() => vi.fn());

vi.mock('@/lib/admin-api-auth', () => ({ requireAdminApi }));

const { GET } = await import('@/app/admin/audit/export/route');

const OPERATION_ID = '11111111-1111-4111-8111-111111111111';

function row(overrides: Record<string, unknown> = {}) {
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
    before: null,
    after: null,
    metadata: { requested_count: 2 },
    ...overrides,
  };
}

function request(query = '') {
  return new Request(`https://example.org/admin/audit/export${query}`);
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

  it('exports only rows matching the URL filters', async () => {
    const client = createMockAdminClient({
      admin_audit_log: {
        rows: [
          row(),
          row({
            id: '22222222-2222-4222-8222-222222222222',
            action: 'content.publish',
            target_type: 'content',
            target_id: 'a-page',
            target_label: 'A page',
          }),
        ],
      },
    });
    requireAdminApi.mockResolvedValue({ ok: true, session: { adminClient: client } });

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
  });

  it('refuses an oversized export rather than truncating it', async () => {
    const client = createMockAdminClient({
      admin_audit_log: { rows: [], count: ADMIN_AUDIT_MAX_EXPORT_ROWS + 1 },
    });
    requireAdminApi.mockResolvedValue({ ok: true, session: { adminClient: client } });

    const response = await GET(request());

    expect(response.status).toBe(413);
    await expect(response.text()).resolves.toContain('Narrow the filters');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
});
