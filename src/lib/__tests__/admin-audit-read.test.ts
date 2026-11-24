// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  ADMIN_AUDIT_MAX_EXPORT_ROWS,
  AdminAuditExportTooLargeError,
  type AdminAuditOperation,
  adminAuditHref,
  EMPTY_ADMIN_AUDIT_FILTERS,
  exportAdminAuditCsv,
  getAdminAuditContactBulkChanges,
  getAdminAuditOperation,
  getAdminAuditPage,
  parseAdminAuditFilters,
  parseAdminAuditPage,
  toAdminAuditCsv,
} from '@/lib/admin-audit-read';
import { createMockAdminClient } from './supabase-mock';

const OPERATION_ID = '11111111-1111-4111-8111-111111111111';
const CONTACT_ID = '33333333-3333-4333-8333-333333333333';
const CONTACT_2 = '44444444-4444-4444-8444-444444444444';
const CONTACT_3 = '55555555-5555-4555-8555-555555555555';

type TestAuditOperation = AdminAuditOperation & Record<string, unknown>;

function auditRow(overrides: Partial<AdminAuditOperation> = {}): TestAuditOperation {
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
    metadata: { requested_count: 2, updated_count: 2 },
    ...overrides,
  };
}

function clientWith(rows: TestAuditOperation[], count?: number) {
  return createMockAdminClient({
    admin_audit_log: {
      rows,
      ...(count === undefined ? {} : { count }),
    },
  });
}

describe('admin audit filters', () => {
  it('normalizes valid filters and drops values the database cannot accept', () => {
    expect(
      parseAdminAuditFilters({
        actor: '  organizer@example.org  ',
        action: 'crm.contact.bulk_update',
        outcome: 'success',
        from: '2026-11-01',
        to: '2026-11-19',
        targetType: 'crm_contact',
        target: '  c1  ',
        contact: `  ${CONTACT_ID}  `,
      })
    ).toEqual({
      actor: 'organizer@example.org',
      action: 'crm.contact.bulk_update',
      outcome: 'success',
      from: '2026-11-01',
      to: '2026-11-19',
      targetType: 'crm_contact',
      target: 'c1',
      contact: CONTACT_ID,
    });

    expect(
      parseAdminAuditFilters({
        action: 'not.an.action',
        outcome: 'maybe',
        from: '2026-02-31',
        to: 'yesterday',
        targetType: 'everything',
      })
    ).toEqual(EMPTY_ADMIN_AUDIT_FILTERS);
  });

  it('parses only positive page numbers', () => {
    expect(parseAdminAuditPage('3')).toBe(3);
    expect(parseAdminAuditPage('0')).toBe(1);
    expect(parseAdminAuditPage('-2')).toBe(1);
    expect(parseAdminAuditPage('nope')).toBe(1);
  });

  it('preserves filters in detail and export links', () => {
    const href = adminAuditHref(
      '/admin/audit/export',
      {
        ...EMPTY_ADMIN_AUDIT_FILTERS,
        actor: 'organizer@example.org',
        action: 'crm.contact.bulk_update',
        from: '2026-11-01',
        targetType: 'crm_contact',
        target: 'c1',
        contact: CONTACT_ID,
      },
      2
    );

    expect(href).toContain('/admin/audit/export?');
    expect(href).toContain('actor=organizer%40example.org');
    expect(href).toContain('action=crm.contact.bulk_update');
    expect(href).toContain('from=2026-11-01');
    expect(href).toContain('targetType=crm_contact');
    expect(href).toContain('target=c1');
    expect(href).toContain(`contact=${CONTACT_ID}`);
    expect(href).toContain('page=2');
  });
});

describe('admin audit queries', () => {
  it('pages newest operations first with an exact total count', async () => {
    const rows = Array.from({ length: 60 }, (_, index) =>
      auditRow({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        created_at: new Date(Date.UTC(2026, 10, 19, 12, index)).toISOString(),
      })
    );

    const result = await getAdminAuditPage(clientWith(rows), EMPTY_ADMIN_AUDIT_FILTERS, 2);

    expect(result.totalCount).toBe(60);
    expect(result.rows).toHaveLength(10);
    // The second page is the older half after newest-first ordering.
    expect(result.rows[0]?.created_at).toBe('2026-11-19T12:09:00.000Z');
  });

  it('combines actor, action, outcome, date, target type, target and contact filters', async () => {
    const matching = auditRow({
      metadata: { requested_ids: [CONTACT_ID], requested_count: 2, updated_count: 2 },
    });
    const other = auditRow({
      id: '22222222-2222-4222-8222-222222222222',
      actor_email: 'other@example.org',
      action: 'content.publish',
      outcome: 'failure',
      target_type: 'content',
      target_id: 'a-page',
      target_label: 'A page',
      created_at: '2026-10-01T12:00:00.000Z',
    });
    const client = createMockAdminClient({
      admin_audit_log: {
        rows: [matching, other],
        // The mock does not evaluate PostgREST's `.or()` language; this is the
        // set it should have selected for the target filter.
        filterRows: [matching],
      },
    });

    const result = await getAdminAuditPage(
      client,
      {
        actor: 'organizer@example.org',
        action: 'crm.contact.bulk_update',
        outcome: 'success',
        from: '2026-11-01',
        to: '2026-11-19',
        targetType: 'crm_contact',
        target: 'bulk-update',
        contact: CONTACT_ID,
      },
      1
    );

    expect(result.totalCount).toBe(1);
    expect(result.rows[0]?.id).toBe(OPERATION_ID);
  });

  it('matches the contact filter against metadata.requested_ids', async () => {
    const matching = auditRow({ metadata: { requested_ids: [CONTACT_ID] } });
    const other = auditRow({
      id: '22222222-2222-4222-8222-222222222222',
      metadata: { requested_ids: ['44444444-4444-4444-8444-444444444444'] },
    });
    const client = createMockAdminClient(
      { admin_audit_log: { rows: [matching, other], filterRows: [matching] } },
      { recordFilters: true }
    );

    const result = await getAdminAuditPage(
      client,
      { ...EMPTY_ADMIN_AUDIT_FILTERS, contact: CONTACT_ID.toUpperCase() },
      1
    );

    expect(result.rows.map((row) => row.id)).toEqual([OPERATION_ID]);
    expect(client.filterCalls).toContainEqual({
      method: 'contains',
      args: ['metadata', { requested_ids: [CONTACT_ID] }],
    });
  });

  it('pages bulk updates that selected one contact', async () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      auditRow({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        created_at: new Date(Date.UTC(2026, 10, 19, 12, index)).toISOString(),
        metadata: { requested_ids: [CONTACT_ID] },
      })
    );
    const client = createMockAdminClient(
      { admin_audit_log: { rows, filterRows: rows } },
      { recordFilters: true }
    );

    const result = await getAdminAuditContactBulkChanges(client, CONTACT_ID.toUpperCase(), 2);

    expect(result.totalCount).toBe(12);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.created_at).toBe('2026-11-19T12:01:00.000Z');
    expect(client.filterCalls).toContainEqual({
      method: 'contains',
      args: ['metadata', { requested_ids: [CONTACT_ID] }],
    });
  });

  it('loads one operation by exact uuid and rejects malformed ids', async () => {
    const operation = auditRow({
      before: { status: 'supporter' },
      after: { status: 'active_volunteer' },
    });
    const client = clientWith([operation]);

    await expect(getAdminAuditOperation(client, OPERATION_ID)).resolves.toMatchObject({
      id: OPERATION_ID,
      before: { status: 'supporter' },
      metadata: { requested_count: 2, updated_count: 2 },
    });
    await expect(getAdminAuditOperation(client, 'not-a-uuid')).resolves.toBeNull();
  });
});

describe('admin audit CSV', () => {
  it('quotes commas and newlines and neutralizes spreadsheet formulas', () => {
    const csv = toAdminAuditCsv([
      auditRow({
        target_label: 'A, "quoted"',
        error: '=HYPERLINK("https://example.org")',
        metadata: { note: 'line one\nline two' },
      }),
    ]);

    expect(csv).toContain('"A, ""quoted"""');
    expect(csv).toContain(`"'=HYPERLINK(""https://example.org"")"`);
    expect(csv).toContain('line one\\nline two');
    expect(csv).toContain('Bulk contacts updated');
  });

  it('writes normalized bulk-update evidence into dedicated columns', () => {
    const csv = toAdminAuditCsv([
      auditRow({
        before: {
          contacts: [
            { id: CONTACT_ID, status: 'supporter', tags: ['one'] },
            { id: CONTACT_2, status: 'supporter', tags: ['one'] },
          ],
        },
        after: {
          contacts: [
            { id: CONTACT_ID, status: 'active_volunteer', tags: ['one', 'two'] },
            { id: CONTACT_2, status: 'supporter', tags: ['one'] },
          ],
        },
        metadata: {
          requested_count: 3,
          requested_ids: [CONTACT_ID, CONTACT_2, CONTACT_3],
          affected_count: 2,
          affected_ids: [CONTACT_ID, CONTACT_2],
          updated_count: 1,
          changed_fields: ['status', 'tags'],
        },
      }),
    ]);
    const [header = '', first = ''] = csv.split('\r\n');

    expect(header).toContain(
      'Requested count,Affected count,Updated count,Changed fields,Requested IDs,Affected IDs'
    );
    expect(first).toContain('"3","2","1","[""status"",""tags""]"');
    expect(first).toContain(`"[""${CONTACT_ID}"",""${CONTACT_2}"",""${CONTACT_3}""]"`);
    expect(first).toContain(`"[""${CONTACT_ID}"",""${CONTACT_2}""]"`);
  });

  it('leaves the Updated count blank for a bulk delete while retaining its ids', () => {
    const csv = toAdminAuditCsv([
      auditRow({
        action: 'crm.contact.bulk_delete',
        before: {
          contacts: [{ id: CONTACT_ID, email: 'ada@example.org' }],
        },
        after: {
          contacts: [{ id: CONTACT_ID, deleted: true }],
        },
        metadata: {
          requested_count: 2,
          requested_ids: [CONTACT_ID, CONTACT_2],
          affected_count: 1,
          affected_ids: [CONTACT_ID],
          deleted_count: 1,
        },
      }),
    ]);
    const first = csv.split('\r\n')[1] ?? '';

    expect(first).toContain('"2","1",""');
    expect(first).toContain(`"[""${CONTACT_ID}"",""${CONTACT_2}""]"`);
    expect(first).toContain(`"[""${CONTACT_ID}""]"`);
  });

  it('exports every matching row in batches and returns the exact manifest', async () => {
    const rows = [
      auditRow({ before: { status: 'supporter' }, after: { status: 'active_volunteer' } }),
      auditRow({
        id: '22222222-2222-4222-8222-222222222222',
        created_at: '2026-11-19T13:00:00.000Z',
        action: 'content.publish',
        target_type: 'content',
        target_id: 'a-page',
      }),
    ];

    const result = await exportAdminAuditCsv(clientWith(rows), EMPTY_ADMIN_AUDIT_FILTERS);

    expect(result.csv.split('\r\n')).toHaveLength(4);
    expect(result.csv).toContain('Content published');
    expect(result.csv).toContain('"{""status"":""supporter""}"');
    expect(result.csv).toContain('"{""status"":""active_volunteer""}"');
    expect(result.rowCount).toBe(2);
    expect(result.operationIds).toEqual([OPERATION_ID, '22222222-2222-4222-8222-222222222222']);
  });

  it('refuses an export above the row cap instead of truncating silently', async () => {
    const client = clientWith([], ADMIN_AUDIT_MAX_EXPORT_ROWS + 1);

    await expect(exportAdminAuditCsv(client, EMPTY_ADMIN_AUDIT_FILTERS)).rejects.toBeInstanceOf(
      AdminAuditExportTooLargeError
    );
  });
});
