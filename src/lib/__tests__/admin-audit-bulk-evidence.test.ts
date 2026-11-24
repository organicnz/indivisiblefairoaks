// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  type AdminAuditBulkContactDiff,
  parseAdminAuditBulkEvidence,
} from '@/lib/admin-audit-bulk-evidence';
import type { AdminAuditOperation } from '@/lib/admin-audit-read';

const OPERATION_ID = '11111111-1111-4111-8111-111111111111';
const CONTACT_1 = '33333333-3333-4333-8333-333333333333';
const CONTACT_2 = '44444444-4444-4444-8444-444444444444';
const CONTACT_3 = '55555555-5555-4555-8555-555555555555';

function operation(overrides: Partial<AdminAuditOperation> = {}): AdminAuditOperation {
  return {
    id: OPERATION_ID,
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
    before: null,
    after: null,
    metadata: {},
    ...overrides,
  };
}

function contact(contacts: AdminAuditBulkContactDiff[], id: string) {
  return contacts.find((entry) => entry.id === id);
}

describe('parseAdminAuditBulkEvidence', () => {
  it('extracts requested, affected, updated, and not-affected counts with field diffs', () => {
    const evidence = parseAdminAuditBulkEvidence(
      operation({
        before: {
          contact_ids: [CONTACT_1, CONTACT_2],
          contacts: [
            {
              id: CONTACT_1,
              status: 'supporter',
              district: 'CA-06',
              tags: ['volunteer'],
            },
            {
              id: CONTACT_2,
              status: 'supporter',
              district: 'CA-06',
              tags: ['volunteer'],
            },
          ],
        },
        after: {
          contact_ids: [CONTACT_1, CONTACT_2],
          contacts: [
            {
              id: CONTACT_1,
              status: 'active_volunteer',
              district: 'CA-07',
              tags: ['volunteer', 'choir'],
            },
            {
              id: CONTACT_2,
              status: 'supporter',
              district: 'CA-06',
              tags: ['volunteer'],
            },
          ],
        },
        metadata: {
          requested_count: 3,
          requested_ids: [CONTACT_1, CONTACT_2, CONTACT_3],
          affected_count: 2,
          affected_ids: [CONTACT_1, CONTACT_2],
          updated_count: 2,
          changed_fields: ['status', 'district', 'tags'],
        },
      })
    );

    expect(evidence).toMatchObject({
      action: 'crm.contact.bulk_update',
      requested: 3,
      affected: 2,
      updated: 2,
      notAffected: 1,
      updatedLabel: 'Updated',
      requestedIds: [CONTACT_1, CONTACT_2, CONTACT_3],
      affectedIds: [CONTACT_1, CONTACT_2],
      changedFields: ['status', 'district', 'tags'],
    });
    expect(evidence?.contacts).toHaveLength(2);

    const first = contact(evidence?.contacts ?? [], CONTACT_1);
    expect(first?.fields).toEqual([
      { key: 'status', label: 'Status', before: 'Supporter', after: 'Active Volunteer' },
      { key: 'district', label: 'District', before: 'CA-06', after: 'CA-07' },
      { key: 'tags', label: 'Tags', before: '#volunteer', after: '#volunteer, #choir' },
    ]);

    const second = contact(evidence?.contacts ?? [], CONTACT_2);
    expect(second?.fields).toEqual([]);
  });

  it('does not treat tag order as a change', () => {
    const evidence = parseAdminAuditBulkEvidence(
      operation({
        before: { contacts: [{ id: CONTACT_1, tags: ['one', 'two'] }] },
        after: { contacts: [{ id: CONTACT_1, tags: ['two', 'one'] }] },
        metadata: { requested_count: 1, requested_ids: [CONTACT_1] },
      })
    );

    expect(evidence?.contacts[0]?.fields).toEqual([]);
  });

  it('renders bulk delete evidence as a deletion and skips removed identity fields', () => {
    const evidence = parseAdminAuditBulkEvidence(
      operation({
        action: 'crm.contact.bulk_delete',
        target_id: 'bulk-delete',
        before: {
          contact_ids: [CONTACT_1],
          contacts: [
            {
              id: CONTACT_1,
              email: 'ada@example.org',
              first_name: 'Ada',
              last_name: 'Lovelace',
            },
          ],
        },
        after: {
          contact_ids: [CONTACT_1],
          contacts: [{ id: CONTACT_1, deleted: true }],
        },
        metadata: {
          requested_count: 2,
          requested_ids: [CONTACT_1, CONTACT_2],
          affected_count: 1,
          affected_ids: [CONTACT_1],
          deleted_count: 1,
        },
      })
    );

    expect(evidence).toMatchObject({
      action: 'crm.contact.bulk_delete',
      requested: 2,
      affected: 1,
      updated: 1,
      notAffected: 1,
      updatedLabel: 'Deleted',
    });
    expect(evidence?.contacts[0]).toMatchObject({
      id: CONTACT_1,
      name: 'Ada Lovelace',
      email: 'ada@example.org',
      deleted: true,
    });
    expect(evidence?.contacts[0]?.fields).toEqual([
      { key: 'deleted', label: 'Deleted', before: 'No', after: 'Yes' },
    ]);
  });

  it('treats an omitted affected count as zero when the request count was recorded', () => {
    const evidence = parseAdminAuditBulkEvidence(
      operation({
        outcome: 'failure',
        metadata: {
          requested_count: 2,
          requested_ids: [CONTACT_1, CONTACT_2],
          changed_fields: ['status'],
        },
      })
    );

    expect(evidence).toMatchObject({
      requested: 2,
      affected: 0,
      updated: null,
      notAffected: 2,
      requestedIds: [CONTACT_1, CONTACT_2],
      affectedIds: [],
      changedFields: ['status'],
      contacts: [],
    });
  });

  it('normalizes the consent changed-field alias to the snapshot field name', () => {
    const evidence = parseAdminAuditBulkEvidence(
      operation({
        metadata: {
          requested_count: 1,
          requested_ids: [CONTACT_1],
          updated_count: 1,
          changed_fields: ['consent', 'consent'],
        },
      })
    );

    expect(evidence?.changedFields).toEqual(['do_not_email']);
  });

  it('deduplicates ids and derives changed fields from snapshots when metadata omits them', () => {
    const evidence = parseAdminAuditBulkEvidence(
      operation({
        before: {
          contacts: [{ id: CONTACT_1, status: 'supporter', tags: ['one'] }],
        },
        after: {
          contacts: [{ id: CONTACT_1, status: 'active_volunteer', tags: ['one', 'two'] }],
        },
        metadata: {
          requested_count: 1,
          requested_ids: [CONTACT_1, CONTACT_1],
          affected_ids: [CONTACT_1, CONTACT_1],
        },
      })
    );

    expect(evidence).toMatchObject({
      requested: 1,
      affected: 1,
      requestedIds: [CONTACT_1],
      affectedIds: [CONTACT_1],
      changedFields: ['status', 'tags'],
    });
  });

  it('returns null for a non-bulk operation so the raw view remains the fallback', () => {
    expect(
      parseAdminAuditBulkEvidence(
        operation({
          action: 'content.publish',
          before: { published: false },
          after: { published: true },
          metadata: { requested_count: 1 },
        })
      )
    ).toBeNull();
  });
});
