// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchMock } from './fetch-mock';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));
vi.mock('server-only', () => ({}));

const mockAdminClient = { from: vi.fn(), rpc: vi.fn() };
const session = vi.hoisted(() => ({
  adminUserId: 'admin-user-uuid-1234',
  adminEmail: 'organizer@indivisiblefairoaks.org',
}));

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: vi.fn(async () => ({
    adminClient: mockAdminClient,
    get adminUserId() {
      return session.adminUserId;
    },
    get adminEmail() {
      return session.adminEmail;
    },
    mfaLevel: 'aal2',
  })),
}));

import {
  addCRMNote,
  addCRMTask,
  bulkDeleteCRMContacts,
  bulkUpdateCRMContacts,
  deleteCRMContact,
  deleteCRMNote,
  deleteCRMTask,
  importCRMContacts,
  mergeCRMContacts,
  saveCRMContact,
  sendCRMDirectEmail,
  setCRMTaskStatus,
  updateCRMNote,
  updateCRMTask,
} from '@/lib/actions/crm';
import { CRM_AUDIT_LOST_DETAIL } from '@/lib/actions/crm/shared';
import { env } from '@/lib/env';
import type { MockTableConfig } from './supabase-mock';
import { createMockAdminClient } from './supabase-mock';

const mockEnv = env as unknown as Record<string, string | undefined>;

/**
 * The failure branches of the CRM mutations.
 *
 * The happy paths were covered; what was not covered is what happens when
 * something goes wrong, which for this file is where the chapter's data is at
 * risk — a failed import that reports success, a merge that drops a consent
 * flag, a direct email sent to someone who opted out.
 */

/**
 * Row sets per table, rebuilt for each test.
 *
 * These suites used to hand-roll a `createMockQueryBuilder(terminalResult)` and
 * assert on the response it was told to return, which cannot tell a correct
 * query from one naming the wrong column — the assertion is satisfied by the
 * stub, not by the rows. Describing the *rows* instead means the query has to
 * actually select them: "the row was deleted" is `rows: []`, not
 * `{ data: null }`, and the two are only distinguishable because the mock
 * evaluates `.eq()` against real row data.
 */
let tables: Record<string, MockTableConfig>;

/** Make both durable audit destinations reject the record. */
function failAuditWrites() {
  tables.admin_audit_log = { rows: [], insertError: { message: 'audit log offline' } };
  tables.admin_audit_outbox = { rows: [], insertError: { message: 'outbox offline' } };
}

describe('CRM mutation failure paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `clearAllMocks` clears call history but keeps implementations, including
    // any unconsumed `mockReturnValueOnce` queue — so a test that set up a
    // three-step chain and consumed two steps leaks its last builder into the
    // next test, which then reads a contact it never described. `mockReset`
    // drops the whole implementation.
    mockAdminClient.from.mockReset();
    mockAdminClient.rpc.mockReset();

    // Fresh tables per test, and a `from` that builds a row-backed query over
    // them. Nothing is queued across tests, so nothing can leak either.
    tables = {};
    mockAdminClient.from.mockImplementation(createMockAdminClient(tables).from);

    mockEnv.RESEND_API_KEY = 're_test_key_dummy';
    mockEnv.RESEND_FROM_EMAIL = 'contact@indivisiblefairoaks.org';
    mockEnv.ADMIN_ORDER_EMAIL = 'contact@indivisiblefairoaks.org';
    mockEnv.CRM_BROADCAST_FUNCTION_URL = undefined;
    mockEnv.SUPABASE_SECRET_KEY = undefined;
    installFetchMock(vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });

  describe('saveCRMContact', () => {
    it('refuses an update to a row that has since been deleted', async () => {
      // The author has a form open on a contact somebody else removed. Writing
      // blind would either resurrect the row or report a save that never
      // happened. The update runs `.eq('id', id).select('id').maybeSingle()`,
      // so an empty table is what produces the no-match — asserted here as the
      // absence of the row rather than as a canned `data: null`.
      tables.crm_contacts = { rows: [] };

      const res = await saveCRMContact({
        id: '11111111-2222-4333-8444-555555555555',
        email: 'a@b.co',
        first_name: 'Robin',
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/no longer exists/i);
    });

    it('surfaces a lookup failure instead of claiming the contact is gone', async () => {
      tables.crm_contacts = { rows: [], error: { message: 'connection reset' } };

      const res = await saveCRMContact({
        id: '11111111-2222-4333-8444-555555555555',
        email: 'a@b.co',
        first_name: 'Robin',
      });

      expect(res).toMatchObject({ success: false, error: 'connection reset' });
    });

    it('rejects an email that is not an email before touching the database', async () => {
      const res = await saveCRMContact({ email: 'not-an-email', first_name: 'Robin' });
      expect(res.success).toBe(false);
      expect(mockAdminClient.from).not.toHaveBeenCalled();
    });

    it('maps a duplicate email to the editor duplicate state rather than a Postgres code', async () => {
      // 23505 is the unique constraint's race-condition backstop. The editor's
      // preflight usually prevents this branch, but a concurrent create can win
      // between the lookup and the insert.
      tables.crm_contacts = { rows: [], error: { code: '23505', message: 'duplicate key' } };

      const res = await saveCRMContact({ email: 'A@B.co', first_name: 'Robin' });

      expect(res).toMatchObject({
        success: false,
        reason: 'duplicate_email',
        error: 'That email already belongs to another constituent.',
      });
      expect(res.error).not.toMatch(/23505/);
    });

    it('returns the contact that won the race when the insert hits the constraint', async () => {
      // Reads still work after the rejected insert, so the editor can show the
      // same Open/Merge panel it would have shown if its preflight had seen the
      // row before the other organizer created it.
      tables.crm_contacts = {
        rows: [{ id: 'race-winner', email: 'a@b.co', first_name: 'Race', last_name: 'Winner' }],
        insertError: { code: '23505', message: 'duplicate key' },
      };

      const res = await saveCRMContact({ email: '  A@B.co  ', first_name: 'Robin' });

      expect(res).toMatchObject({
        success: false,
        reason: 'duplicate_email',
        duplicateContact: { id: 'race-winner', email: 'a@b.co' },
      });
    });

    it('warns when an updated contact could not be audited', async () => {
      const validUuid = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
      tables.crm_contacts = {
        rows: [
          {
            id: validUuid,
            email: 'old@example.com',
            status: 'supporter',
            tags: [],
            notes: null,
            updated_at: null,
          },
        ],
      };
      tables.crm_activities = { rows: [] };
      failAuditWrites();

      const res = await saveCRMContact({
        id: validUuid,
        email: 'jane@example.com',
        status: 'organizer',
        tags: [],
        updated_at: null,
      });

      expect(res).toMatchObject({ success: true, contactId: validUuid });
      expect(res.warning).toBe(`The contact was updated, but ${CRM_AUDIT_LOST_DETAIL}`);
      expect(tables.crm_contacts.rows?.[0]?.email).toBe('jane@example.com');
      expect(tables.admin_audit_log.rows).toHaveLength(0);
      expect(tables.admin_audit_outbox.rows).toHaveLength(0);
    });

    it('keeps a successful update and warns when its timeline entry fails', async () => {
      const validUuid = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
      tables.crm_contacts = {
        rows: [
          {
            id: validUuid,
            email: 'old@example.com',
            status: 'supporter',
            tags: [],
            notes: null,
          },
        ],
      };
      tables.crm_activities = { rows: [], error: { message: 'audit table offline' } };

      const res = await saveCRMContact({
        id: validUuid,
        email: 'jane@example.com',
        status: 'organizer',
        tags: [],
      });

      expect(res).toMatchObject({ success: true, contactId: validUuid });
      expect(res.warning).toMatch(/timeline entry could not be recorded/i);
      // The contact change is the primary write and must still have landed.
      expect(tables.crm_contacts.rows?.[0]?.status).toBe('organizer');
    });

    it('keeps a successful create and warns when its timeline entry fails', async () => {
      tables.crm_contacts = { rows: [], insert: { id: 'new-contact-123' } };
      tables.crm_activities = { rows: [], error: { message: 'audit table offline' } };

      const res = await saveCRMContact({
        email: 'new@example.com',
        first_name: 'Robin',
      });

      expect(res).toMatchObject({ success: true, contactId: 'new-contact-123' });
      expect(res.warning).toMatch(/timeline entry could not be recorded/i);
      expect(tables.crm_contacts.rows?.[0]?.email).toBe('new@example.com');
    });

    it('warns when a created contact could not be audited', async () => {
      tables.crm_contacts = { rows: [], insert: { id: 'new-contact-123' } };
      tables.crm_activities = { rows: [] };
      failAuditWrites();

      const res = await saveCRMContact({
        email: 'new@example.com',
        first_name: 'Robin',
      });

      expect(res).toEqual({
        success: true,
        contactId: 'new-contact-123',
        warning: `The contact was created, but ${CRM_AUDIT_LOST_DETAIL}`,
      });
      expect(tables.crm_contacts.rows?.[0]?.email).toBe('new@example.com');
    });
  });

  describe('deleteCRMContact', () => {
    it('reports a delete that failed', async () => {
      // A silent success here leaves a row the author believes is gone, and the
      // next export will still contain their address.
      tables.crm_contacts = { error: { message: 'fk violation' } };

      const res = await deleteCRMContact('11111111-2222-4333-8444-555555555555');
      expect(res.success).toBe(false);
      expect(res.error).toBe('fk violation');
    });

    it('deletes cleanly, and the row is actually gone afterwards', async () => {
      // Asserting the row left the table is the point: the old suite asserted
      // that `.delete()` had been *called*, which is true whether or not the
      // filter matched anything.
      tables.crm_contacts = {
        rows: [{ id: '11111111-2222-4333-8444-555555555555', email: 'robin@example.org' }],
      };
      tables.admin_audit_log = { rows: [] };

      await expect(deleteCRMContact('11111111-2222-4333-8444-555555555555')).resolves.toEqual({
        success: true,
      });
      expect(tables.crm_contacts.rows).toHaveLength(0);
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: 'admin-user-uuid-1234',
        actor_email: 'organizer@indivisiblefairoaks.org',
        action: 'crm.contact.delete',
        target_type: 'crm_contact',
        target_id: '11111111-2222-4333-8444-555555555555',
        target_label: 'robin@example.org',
        before: { id: '11111111-2222-4333-8444-555555555555', email: 'robin@example.org' },
        after: null,
        mfa_level: 'aal2',
        outcome: 'success',
      });
    });

    it('warns when a deleted contact could not be audited', async () => {
      tables.crm_contacts = {
        rows: [{ id: '11111111-2222-4333-8444-555555555555', email: 'robin@example.org' }],
      };
      failAuditWrites();

      const res = await deleteCRMContact('11111111-2222-4333-8444-555555555555');

      // The delete committed, so the organizer must not retry it; the missing
      // audit record is the only thing the warning is about.
      expect(res).toEqual({
        success: true,
        warning: `The contact was deleted, but ${CRM_AUDIT_LOST_DETAIL}`,
      });
      expect(tables.crm_contacts.rows).toHaveLength(0);
      expect(tables.admin_audit_log.rows).toHaveLength(0);
      expect(tables.admin_audit_outbox.rows).toHaveLength(0);
    });

    it('reports when the contact was already gone', async () => {
      // `.select('id').maybeSingle()` makes a no-match observable. Without
      // asking for the row back, PostgREST reports success for a delete that
      // removed nothing, and the directory shows a false confirmation.
      tables.crm_contacts = { rows: [] };

      await expect(deleteCRMContact('missing')).resolves.toEqual({
        success: false,
        error: 'That contact no longer exists',
      });
    });
  });

  describe('addCRMNote', () => {
    it('refuses a note with no title', async () => {
      const res = await addCRMNote({
        contactId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        title: '   ',
        description: '',
      });
      expect(res.success).toBe(false);
      expect(mockAdminClient.from).not.toHaveBeenCalled();
    });

    it('trims the title so the timeline is not full of padded headings', async () => {
      const inserted: Record<string, unknown>[] = [];
      tables.crm_activities = { rows: [], insert: {}, onInsert: (row) => inserted.push(row) };

      await addCRMNote({
        contactId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        title: '  Spoke at the fair  ',
        description: 'body',
      });

      // The row that reached the database, not the arguments a stub was handed.
      expect(inserted[0]?.title).toBe('Spoke at the fair');
    });

    it('refuses a title over 200 characters', async () => {
      const res = await addCRMNote({
        contactId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        title: 'x'.repeat(201),
        description: '',
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/200 characters or fewer/i);
      expect(mockAdminClient.from).not.toHaveBeenCalled();
    });

    it('refuses a description over 2000 characters', async () => {
      const res = await addCRMNote({
        contactId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        title: 'Valid title',
        description: 'x'.repeat(2001),
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/2000 characters or fewer/i);
      expect(mockAdminClient.from).not.toHaveBeenCalled();
    });

    it('warns when a created note could not be audited', async () => {
      const contactId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      tables.crm_activities = { rows: [] };
      failAuditWrites();

      const res = await addCRMNote({
        contactId,
        title: 'Attended Rally',
        description: 'Brought 4 neighbors.',
      });

      expect(res).toEqual({
        success: true,
        warning: `The note was added, but ${CRM_AUDIT_LOST_DETAIL}`,
      });
      expect(tables.crm_activities.rows?.[0]?.title).toBe('Attended Rally');
    });
  });

  describe('importCRMContacts', () => {
    const csv = ['email,first_name', 'a@example.org,Robin', 'b@example.org,Sam'].join('\n');

    it('refuses an empty file before parsing it', async () => {
      const res = await importCRMContacts({ csv: '   ' });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/required/i);
    });

    it('refuses a file over the size cap', async () => {
      const res = await importCRMContacts({ csv: 'x'.repeat(500_001) });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/too large/i);
    });

    it('refuses a file with no usable rows and says why', async () => {
      const res = await importCRMContacts({ csv: 'nothing,useful\nhere,either' });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/no valid rows/i);
      expect(res.errors?.length).toBeGreaterThan(0);
    });

    it('fails the whole import when the existing-email lookup fails', async () => {
      // The lookup is a pre-check, not a nicety: PostgREST `.in('email', …)` is
      // case-sensitive, so without it a mixed-case duplicate reaches the insert
      // and — because an insert chunk is all-or-nothing — poisons a hundred good
      // rows along with it. A lookup error must stop the import, not skip the
      // check and insert anyway.
      tables.crm_contacts = { rows: [], error: { message: 'timeout' } };

      const res = await importCRMContacts({ csv });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/lookup failed/i);
    });

    it('reports no success when every insert was rejected', async () => {
      // One config serves both the pre-check read and the insert, so the
      // pre-check would fail here too — this asserts the outcome, not which
      // step rejected it.
      tables.crm_contacts = { rows: [], error: { message: 'permission denied' } };

      const res = await importCRMContacts({ csv });

      expect(res.success).toBe(false);
      // A green toast over an import that wrote nothing is the worst outcome
      // available here: the volunteer believes their list is loaded.
      expect(res.error).toBeTruthy();
    });

    it('writes nothing when the insert is rejected', async () => {
      tables.crm_contacts = { rows: [], error: { message: 'permission denied' } };

      await importCRMContacts({ csv });

      expect(tables.crm_contacts.rows).toHaveLength(0);
    });

    it('warns when contacts imported but their timeline entries failed', async () => {
      tables.crm_contacts = { rows: [] };
      tables.crm_activities = { rows: [], error: { message: 'audit table offline' } };

      const res = await importCRMContacts({ csv });

      expect(res.success).toBe(true);
      expect(res.imported).toBe(2);
      expect(res.warning).toMatch(/timeline entries could not be recorded/i);
      expect(tables.crm_contacts.rows).toHaveLength(2);
    });

    it('carries the address column, so a restored backup keeps it', async () => {
      const withAddress = [
        'email,first_name,address',
        'a@example.org,Robin,4821 Fair Oaks Blvd',
      ].join('\n');
      // The importer makes a pre-check read (`.in('email', …)`, which matches
      // nothing here — `rows: []`) and then a chunked insert, both against the
      // same table. That used to need a `Once` queue, which leaked into the
      // next test because `vi.clearAllMocks` does not drain unconsumed values.
      tables.crm_contacts = { rows: [] };

      await importCRMContacts({ csv: withAddress });

      // The address the exporter wrote has to reach the row, or a restored
      // backup loses every street address in the chapter.
      expect(tables.crm_contacts.rows?.[0]?.address).toBe('4821 Fair Oaks Blvd');
    });

    it('records one operation audit with actor, counts and outcome', async () => {
      tables.crm_contacts = { rows: [] };
      tables.admin_audit_log = { rows: [] };

      const res = await importCRMContacts({ csv });

      expect(res).toMatchObject({ success: true, imported: 2, skipped: 0 });
      expect(tables.admin_audit_log.rows).toHaveLength(1);
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        actor_email: session.adminEmail,
        action: 'crm.contacts.import',
        target_type: 'crm_operation',
        target_id: 'crm-import',
        outcome: 'success',
        error: null,
        metadata: {
          format: 'csv',
          total_row_count: 2,
          parsed_row_count: 2,
          invalid_row_count: 0,
          imported_count: 2,
          skipped_count: 0,
          failed_row_count: 0,
          error_count: 0,
          errors: [],
        },
      });
    });

    it('warns when a completed import could not be audited', async () => {
      tables.crm_contacts = { rows: [] };
      failAuditWrites();

      const res = await importCRMContacts({ csv });

      expect(res.success).toBe(true);
      expect(res.imported).toBe(2);
      expect(res.warning).toBe(`The import completed, but ${CRM_AUDIT_LOST_DETAIL}`);
    });

    it('audits a rejected import with its parse errors and outcome', async () => {
      tables.admin_audit_log = { rows: [] };

      const res = await importCRMContacts({ csv: 'nothing,useful\nhere,either' });

      expect(res.success).toBe(false);
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        action: 'crm.contacts.import',
        target_type: 'crm_operation',
        outcome: 'failure',
        error: 'No valid rows found in CSV',
        metadata: {
          parsed_row_count: 0,
          invalid_row_count: expect.any(Number),
          error_count: expect.any(Number),
          imported_count: 0,
          skipped_count: 0,
        },
      });
    });
  });

  describe('mergeCRMContacts', () => {
    it('refuses to merge a contact into itself', async () => {
      // Otherwise the merge deletes the row it just moved everything onto, and
      // the person is gone from the directory entirely.
      tables.admin_audit_log = { rows: [] };
      const res = await mergeCRMContacts({ keepId: 'c1', removeId: 'c1' });
      expect(res.success).toBe(false);
      expect(mockAdminClient.from).not.toHaveBeenCalledWith('crm_contacts');
      expect(mockAdminClient.rpc).not.toHaveBeenCalled();
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        action: 'crm.contact.merge',
        target_id: 'c1',
        outcome: 'failure',
        error: 'Cannot merge a contact into itself',
        metadata: { requested_contact_count: 2, merged_contact_count: 0 },
      });
    });

    /**
     * The merge is one RPC (migration 20261005030000) rather than four
     * PostgREST statements, so the failure this suite used to exercise — the
     * activities update succeeding and the contact update then failing, leaving
     * a half-applied merge — is no longer reachable from this side. The whole
     * point of the change is that there is no in-between state: the function is
     * one statement, so it commits or it does not.
     *
     * What *is* still testable here is the action's half: it must report the
     * RPC's error rather than claiming success, because "Merge failed: …" is the
     * only thing the operator learns about a rolled-back merge.
     */
    it('reports the RPC error rather than claiming a rolled-back merge succeeded', async () => {
      tables.crm_contacts = { rows: [{ id: 'keep-1' }, { id: 'dup-1' }] };
      tables.admin_audit_log = { rows: [] };
      mockAdminClient.rpc.mockResolvedValue({
        error: { message: 'the duplicate contact no longer exists' },
      });

      const res = await mergeCRMContacts({ keepId: 'keep-1', removeId: 'dup-1' });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/no longer exists/);
      // Only the two existence reads reached the client. No write statement is
      // issued from the app at all, which is the property the RPC bought: there
      // is no window in which the duplicate's timeline has moved and the survivor
      // has not been updated.
      expect(
        mockAdminClient.from.mock.calls.filter(([table]) => table === 'crm_contacts')
      ).toHaveLength(2);
      expect(mockAdminClient.from).toHaveBeenCalledWith('crm_contacts');
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        action: 'crm.contact.merge',
        target_type: 'crm_contact',
        target_id: 'keep-1',
        outcome: 'failure',
        error: 'Merge failed: the duplicate contact no longer exists',
        metadata: { requested_contact_count: 2, merged_contact_count: 0 },
      });
    });

    it('warns when merged contacts could not be audited', async () => {
      tables.crm_contacts = {
        rows: [
          { id: 'keep-1', email: 'keep@example.org' },
          { id: 'dup-1', email: 'dup@example.org' },
        ],
      };
      mockAdminClient.rpc.mockResolvedValue({ error: null });
      failAuditWrites();

      const res = await mergeCRMContacts({ keepId: 'keep-1', removeId: 'dup-1' });

      expect(res).toEqual({
        success: true,
        warning: `The contacts were merged, but ${CRM_AUDIT_LOST_DETAIL}`,
      });
      expect(tables.admin_audit_log.rows).toHaveLength(0);
      expect(tables.admin_audit_outbox.rows).toHaveLength(0);
    });

    it('surfaces a read failure instead of claiming a contact is missing', async () => {
      tables.crm_contacts = { rows: [], error: { message: 'connection reset' } };

      const res = await mergeCRMContacts({ keepId: 'keep-1', removeId: 'dup-1' });

      expect(res).toMatchObject({ success: false, error: 'connection reset' });
      expect(mockAdminClient.rpc).not.toHaveBeenCalled();
    });
  });

  describe('sendCRMDirectEmail', () => {
    beforeEach(() => {
      // Every direct-email action writes its durable ledger row before calling
      // Resend. Scope this to the send suite; the other CRM mutations never
      // touch the table.
      tables.crm_direct_email_sends = { rows: [] };
    });

    // The rate limiter is module-level state keyed on the admin id, so every
    // send test in a file draws from one budget. Distinct ids keep each test
    // independent rather than leaving the order to decide.
    let seq = 0;
    const freshAdmin = () => {
      seq += 1;
      session.adminUserId = `admin-user-send-${seq}`;
    };

    it('refuses to send to someone who opted out', async () => {
      freshAdmin();
      // The single most important guard in the file: a person who asked not to
      // be emailed. This has to be checked before the provider is called, not
      // after. The opt-out is a *row property*, so the row has to be there — a
      // stubbed `{ do_not_email: true }` response would have proved nothing
      // about whether the query could find it.
      tables.crm_contacts = { rows: [{ id: 'c1', email: 'a@b.co', do_not_email: true }] };

      const res = await sendCRMDirectEmail({ contactId: 'c1', subject: 'Hi', message: 'There' });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/do.not.email|unsubscribed|opted out/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    /**
     * The `NULL` case — and the one that actually mails people. `do_not_email`
     * is tri-state since the consent migration, and `NULL` ("never asked") is
     * what profile signups and store orders produce. `NULL` is falsy in JS, so
     * the old truthiness guard mailed every one of them. This seeded only
     * `true` until the fix, which is why the hole passed.
     */
    it('refuses to send to a contact who was never asked', async () => {
      freshAdmin();
      tables.crm_contacts = { rows: [{ id: 'c1', email: 'a@b.co', do_not_email: null }] };

      const res = await sendCRMDirectEmail({ contactId: 'c1', subject: 'Hi', message: 'There' });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/no consent|never asked|opt in/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('reports a contact that does not exist', async () => {
      freshAdmin();
      tables.crm_contacts = { rows: [] };

      const res = await sendCRMDirectEmail({
        contactId: 'missing',
        subject: 'Hi',
        message: 'There',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Contact not found');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('surfaces a contact lookup failure instead of saying the contact is missing', async () => {
      freshAdmin();
      tables.crm_contacts = { rows: [], error: { message: 'connection reset' } };

      const res = await sendCRMDirectEmail({
        contactId: 'c1',
        subject: 'Hi',
        message: 'There',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Could not load contact: connection reset');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('surfaces a provider rejection instead of reporting a send', async () => {
      freshAdmin();
      const sendKey = '22222222-3333-4444-8555-666666666666';
      tables.crm_contacts = {
        rows: [{ id: 'c1', email: 'a@b.co', do_not_email: false, first_name: 'Robin' }],
      };
      const activities: Record<string, unknown>[] = [];
      tables.crm_activities = { rows: [], insert: {}, onInsert: (row) => activities.push(row) };
      tables.admin_audit_log = { rows: [] };
      installFetchMock(
        vi.fn().mockResolvedValue({
          ok: false,
          status: 422,
          text: async () => '{"message":"domain not verified"}',
          json: async () => ({ message: 'domain not verified' }),
        })
      );

      const res = await sendCRMDirectEmail({
        contactId: 'c1',
        subject: 'Hi',
        message: 'There',
        idempotencyKey: sendKey,
      });

      expect(res.success).toBe(false);
      // The activity row must not claim a delivery that did not happen.
      expect(activities).toHaveLength(0);
      // The pre-registered row is settled to failed, so a retry with the same
      // key knows this attempt produced no acceptance.
      expect(tables.crm_direct_email_sends.rows?.[0]).toMatchObject({
        idempotency_key: sendKey,
        status: 'failed',
        provider_status: 422,
        error: expect.stringContaining('domain not verified'),
      });
      expect(tables.admin_audit_log.rows).toHaveLength(1);
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        actor_email: session.adminEmail,
        action: 'crm.direct_email.send',
        target_type: 'crm_contact',
        target_id: 'c1',
        target_label: 'a@b.co',
        outcome: 'failure',
        error: expect.stringContaining('Email dispatch failed'),
        after: {
          email: 'a@b.co',
          subject: 'Hi',
          provider_status: 422,
        },
      });
      expect(tables.admin_audit_log.rows?.[0]?.error).toContain('domain not verified');
    });

    it('retries a rejected send with the same key instead of sending a second copy', async () => {
      freshAdmin();
      const sendKey = '99999999-aaaa-4bbb-8ccc-dddddddddddd';
      tables.crm_contacts = {
        rows: [{ id: 'c1', email: 'a@b.co', do_not_email: false, first_name: 'Robin' }],
      };
      tables.crm_activities = { rows: [] };
      tables.admin_audit_log = { rows: [] };
      const mockFetch = installFetchMock(
        vi
          .fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 422,
            text: async () => '{"message":"temporary rejection"}',
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ id: 'e-retried' }),
          })
      );

      const first = await sendCRMDirectEmail({
        contactId: 'c1',
        subject: 'Hi',
        message: 'There',
        idempotencyKey: sendKey,
      });
      expect(first.success).toBe(false);
      expect(tables.crm_direct_email_sends.rows?.[0]).toMatchObject({
        status: 'failed',
        provider_status: 422,
      });

      const second = await sendCRMDirectEmail({
        contactId: 'c1',
        subject: 'Hi',
        message: 'There',
        idempotencyKey: sendKey,
      });

      expect(second.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const firstInit = mockFetch.mock.calls[0]?.[1] as { headers?: Record<string, string> };
      const secondInit = mockFetch.mock.calls[1]?.[1] as { headers?: Record<string, string> };
      expect(firstInit.headers?.['Idempotency-Key']).toBe(sendKey);
      expect(secondInit.headers?.['Idempotency-Key']).toBe(sendKey);
      expect(tables.crm_direct_email_sends.rows?.[0]).toMatchObject({
        idempotency_key: sendKey,
        status: 'accepted',
        provider_id: 'e-retried',
        attempts: 2,
      });
      // Only the accepted attempt reaches the contact timeline.
      expect(tables.crm_activities.rows).toHaveLength(1);
      expect(tables.admin_audit_log.rows).toHaveLength(2);
    });

    it('does not warn when the email was sent and its audit record was queued for retry', async () => {
      freshAdmin();
      tables.crm_contacts = {
        rows: [{ id: 'c1', email: 'a@b.co', do_not_email: false, first_name: 'Robin' }],
      };
      tables.crm_activities = { rows: [] };
      tables.admin_audit_log = { rows: [], insertError: { message: 'audit log offline' } };
      tables.admin_audit_outbox = { rows: [] };
      installFetchMock(
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ id: 'e1' }),
          text: async () => '{"id":"e1"}',
        })
      );

      const res = await sendCRMDirectEmail({ contactId: 'c1', subject: 'Hi', message: 'There' });

      expect(res.success).toBe(true);
      expect(res.warning).toBeUndefined();
      expect(tables.admin_audit_log.rows).toHaveLength(0);
      expect(tables.admin_audit_outbox.rows).toHaveLength(1);
      expect(tables.admin_audit_outbox.rows?.[0]?.payload).toMatchObject({
        action: 'crm.direct_email.send',
        target_id: 'c1',
        outcome: 'success',
        after: { email: 'a@b.co', subject: 'Hi', resend_id: 'e1' },
      });
    });

    it('still reports success with the audit warning when neither the log nor the outbox accepts it', async () => {
      freshAdmin();
      tables.crm_contacts = {
        rows: [{ id: 'c1', email: 'a@b.co', do_not_email: false, first_name: 'Robin' }],
      };
      tables.crm_activities = { rows: [] };
      tables.admin_audit_log = { rows: [], insertError: { message: 'audit log offline' } };
      tables.admin_audit_outbox = {
        rows: [],
        insertError: { message: 'outbox offline' },
      };
      installFetchMock(
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ id: 'e1' }),
          text: async () => '{"id":"e1"}',
        })
      );

      const res = await sendCRMDirectEmail({ contactId: 'c1', subject: 'Hi', message: 'There' });

      // The provider accepted the message, so a missing audit record must not
      // turn the send into a failure the organizer might retry.
      expect(res).toEqual({
        success: true,
        warning: `The email was sent, but ${CRM_AUDIT_LOST_DETAIL}`,
      });
      expect(tables.admin_audit_log.rows).toHaveLength(0);
      expect(tables.admin_audit_outbox.rows).toHaveLength(0);
    });

    it('warns when the email was sent but its timeline entry failed', async () => {
      freshAdmin();
      tables.crm_contacts = {
        rows: [{ id: 'c1', email: 'a@b.co', do_not_email: false, first_name: 'Robin' }],
      };
      tables.crm_activities = { rows: [], error: { message: 'audit table offline' } };
      tables.admin_audit_log = { rows: [] };
      installFetchMock(
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ id: 'e1' }),
          text: async () => '{"id":"e1"}',
        })
      );

      const res = await sendCRMDirectEmail({ contactId: 'c1', subject: 'Hi', message: 'There' });

      expect(res.success).toBe(true);
      expect(res.warning).toMatch(/timeline entry could not be recorded/i);
      expect(tables.admin_audit_log.rows).toHaveLength(1);
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        actor_email: session.adminEmail,
        action: 'crm.direct_email.send',
        target_type: 'crm_contact',
        target_id: 'c1',
        target_label: 'a@b.co',
        outcome: 'success',
        error: null,
        after: {
          email: 'a@b.co',
          subject: 'Hi',
          resend_id: 'e1',
        },
      });
    });

    it('builds the plain-text alternative from the configured site, not a literal', async () => {
      freshAdmin();
      // The HTML link came from `NEXT_PUBLIC_SITE_URL` while the text body
      // hardcoded the apex, so a staging build mailed a link that 302s to a
      // Google Sites page. One source of truth, both places.
      mockEnv.NEXT_PUBLIC_SITE_URL = 'https://staging.indivisiblefairoaks.org';
      tables.crm_contacts = {
        rows: [{ id: 'c1', email: 'a@b.co', do_not_email: false, first_name: 'Robin' }],
      };
      let payload: { text?: string } = {};
      // Two arguments: `fetch(url, init)`. A one-parameter mock silently receives
      // the URL as its first argument, the body is never read, and the action
      // reports a transport failure rather than a send.
      installFetchMock(
        vi.fn(async (_url: string, init: { body?: unknown }) => {
          payload = JSON.parse(String(init?.body)) as { text?: string };
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 'e1' }),
            text: async () => '{"id":"e1"}',
          };
        })
      );

      const res = await sendCRMDirectEmail({ contactId: 'c1', subject: 'Hi', message: 'There' });

      expect(res.success).toBe(true);
      expect(payload.text ?? '').not.toContain('https://indivisiblefairoaks.org/');
    });

    it('does not call Resend again when the same accepted key is submitted twice', async () => {
      freshAdmin();
      const sendKey = '33333333-4444-4555-8666-777777777777';
      tables.crm_contacts = {
        rows: [{ id: 'c1', email: 'a@b.co', do_not_email: false, first_name: 'Robin' }],
      };
      tables.crm_activities = { rows: [] };
      tables.admin_audit_log = { rows: [] };
      const mockFetch = installFetchMock(
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ id: 'e-once' }),
        })
      );

      const first = await sendCRMDirectEmail({
        contactId: 'c1',
        subject: 'Hi',
        message: 'There',
        idempotencyKey: sendKey,
      });
      const second = await sendCRMDirectEmail({
        contactId: 'c1',
        subject: 'Hi',
        message: 'There',
        idempotencyKey: sendKey,
      });

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      expect(second.warning).toMatch(/already accepted by Resend/i);
      // The second submit found the accepted ledger row and returned before the
      // provider call. One message, one timeline entry, one audit row.
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(tables.crm_direct_email_sends.rows).toHaveLength(1);
      expect(tables.crm_direct_email_sends.rows?.[0]).toMatchObject({
        idempotency_key: sendKey,
        status: 'accepted',
        provider_id: 'e-once',
      });
      expect(tables.crm_activities.rows).toHaveLength(1);
      expect(tables.admin_audit_log.rows).toHaveLength(1);
    });

    it('recovers a stale pending row with the same provider key instead of sending twice', async () => {
      freshAdmin();
      const sendKey = '44444444-5555-4666-8777-888888888888';
      tables.crm_contacts = {
        rows: [{ id: 'c1', email: 'a@b.co', do_not_email: false, first_name: 'Robin' }],
      };
      tables.crm_activities = { rows: [] };
      tables.admin_audit_log = { rows: [] };
      tables.crm_direct_email_sends = {
        rows: [
          {
            id: 'ledger-stale',
            idempotency_key: sendKey,
            contact_id: 'c1',
            actor_user_id: 'admin-user-original',
            recipient_email: 'a@b.co',
            subject: 'Hi',
            message: 'There',
            status: 'pending',
            provider_id: null,
            provider_status: null,
            error: null,
            attempts: 1,
            // The process that wrote this row died before settling it.
            started_at: new Date(Date.now() - 10 * 60_000).toISOString(),
            accepted_at: null,
          },
        ],
      };
      const mockFetch = installFetchMock(
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ id: 'e-recovered' }),
        })
      );

      const res = await sendCRMDirectEmail({
        contactId: 'c1',
        subject: 'Hi',
        message: 'There',
        idempotencyKey: sendKey,
      });

      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const init = mockFetch.mock.calls[0]?.[1] as { headers?: Record<string, string> };
      expect(init.headers?.['Idempotency-Key']).toBe(sendKey);
      expect(tables.crm_direct_email_sends.rows?.[0]).toMatchObject({
        idempotency_key: sendKey,
        status: 'accepted',
        provider_id: 'e-recovered',
        attempts: 2,
      });
      expect(tables.crm_activities.rows).toHaveLength(1);
      expect(tables.admin_audit_log.rows).toHaveLength(1);

      // A later duplicate finds the recovered row and never reaches Resend.
      const duplicate = await sendCRMDirectEmail({
        contactId: 'c1',
        subject: 'Hi',
        message: 'There',
        idempotencyKey: sendKey,
      });
      expect(duplicate.success).toBe(true);
      expect(duplicate.warning).toMatch(/already accepted by Resend/i);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(tables.crm_activities.rows).toHaveLength(1);
    });

    it('refuses a concurrent duplicate while the first attempt still owns the row', async () => {
      freshAdmin();
      const sendKey = '55555555-6666-4777-8888-999999999999';
      tables.crm_direct_email_sends = {
        rows: [
          {
            id: 'ledger-fresh',
            idempotency_key: sendKey,
            contact_id: 'c1',
            actor_user_id: 'admin-user-original',
            recipient_email: 'a@b.co',
            subject: 'Hi',
            message: 'There',
            status: 'pending',
            provider_id: null,
            provider_status: null,
            error: null,
            attempts: 1,
            started_at: new Date().toISOString(),
            accepted_at: null,
          },
        ],
      };
      const mockFetch = installFetchMock(vi.fn());

      const res = await sendCRMDirectEmail({
        contactId: 'c1',
        subject: 'Hi',
        message: 'There',
        idempotencyKey: sendKey,
      });

      expect(res.success).toBe(true);
      expect(res.warning).toMatch(/already being sent/i);
      // Keep the form and key so the completed attempt can be reconciled.
      expect(res.requiresReconcile).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('refuses to replay an uncertain attempt after the provider idempotency window', async () => {
      freshAdmin();
      const sendKey = '88888888-9999-4aaa-8bbb-cccccccccccc';
      tables.crm_direct_email_sends = {
        rows: [
          {
            id: 'ledger-too-old',
            idempotency_key: sendKey,
            contact_id: 'c1',
            actor_user_id: 'admin-user-original',
            recipient_email: 'a@b.co',
            subject: 'Hi',
            message: 'There',
            status: 'pending',
            provider_id: null,
            provider_status: null,
            error: null,
            attempts: 1,
            // Resend has forgotten this key by now; replaying would risk a
            // second delivery if the original call was accepted.
            started_at: new Date(Date.now() - 25 * 60 * 60_000).toISOString(),
            accepted_at: null,
          },
        ],
      };
      const mockFetch = installFetchMock(vi.fn());

      const res = await sendCRMDirectEmail({
        contactId: 'c1',
        subject: 'Hi',
        message: 'There',
        idempotencyKey: sendKey,
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/too old to retry safely/i);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not call Resend when the ledger cannot record the attempt', async () => {
      freshAdmin();
      tables.crm_contacts = {
        rows: [{ id: 'c1', email: 'a@b.co', do_not_email: false, first_name: 'Robin' }],
      };
      tables.crm_direct_email_sends = {
        rows: [],
        insertError: { message: 'ledger offline' },
      };
      const mockFetch = installFetchMock(vi.fn());

      const res = await sendCRMDirectEmail({
        contactId: 'c1',
        subject: 'Hi',
        message: 'There',
        idempotencyKey: '66666666-7777-4888-8999-aaaaaaaaaaaa',
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/send ledger/i);
      // A provider-accepted message with no durable row is the state this
      // ledger exists to prevent; the provider must not be reached.
      expect(mockFetch).not.toHaveBeenCalled();
      expect(tables.crm_direct_email_sends.rows).toHaveLength(0);
    });

    it('warns when provider acceptance cannot be settled, then reconciles on the same key', async () => {
      freshAdmin();
      const sendKey = '77777777-8888-4999-8aaa-bbbbbbbbbbbb';
      tables.crm_contacts = {
        rows: [{ id: 'c1', email: 'a@b.co', do_not_email: false, first_name: 'Robin' }],
      };
      tables.crm_activities = { rows: [] };
      tables.admin_audit_log = { rows: [] };
      tables.crm_direct_email_sends = {
        rows: [],
        updateError: { message: 'ledger offline' },
      };
      const mockFetch = installFetchMock(
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ id: 'e-crash' }),
        })
      );

      const first = await sendCRMDirectEmail({
        contactId: 'c1',
        subject: 'Hi',
        message: 'There',
        idempotencyKey: sendKey,
      });

      expect(first.success).toBe(true);
      expect(first.warning).toMatch(/send ledger could not be updated/i);
      // The compose form must keep this submission's key; a new key would turn
      // the reconciliation retry into a second email.
      expect(first.requiresReconcile).toBe(true);
      // The provider accepted the message, but the secondary records wait for
      // the ledger so a retry cannot insert a second timeline entry.
      expect(tables.crm_activities.rows).toHaveLength(0);
      expect(tables.admin_audit_log.rows).toHaveLength(0);
      const ledger = tables.crm_direct_email_sends.rows?.[0] as Record<string, unknown> | undefined;
      expect(ledger).toMatchObject({
        idempotency_key: sendKey,
        status: 'pending',
        provider_id: null,
        attempts: 1,
      });

      // Age the pending row past the lease and let the ledger accept writes
      // again. The retry must carry the same provider key and settle the row.
      if (ledger) ledger.started_at = new Date(Date.now() - 10 * 60_000).toISOString();
      tables.crm_direct_email_sends.updateError = null;

      const second = await sendCRMDirectEmail({
        contactId: 'c1',
        subject: 'Hi',
        message: 'There',
        idempotencyKey: sendKey,
      });

      expect(second.success).toBe(true);
      expect(second.warning).toBeUndefined();
      expect(second.requiresReconcile).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const firstInit = mockFetch.mock.calls[0]?.[1] as { headers?: Record<string, string> };
      const secondInit = mockFetch.mock.calls[1]?.[1] as { headers?: Record<string, string> };
      expect(firstInit.headers?.['Idempotency-Key']).toBe(sendKey);
      expect(secondInit.headers?.['Idempotency-Key']).toBe(sendKey);
      expect(ledger).toMatchObject({
        status: 'accepted',
        provider_id: 'e-crash',
        attempts: 2,
      });
      expect(tables.crm_activities.rows).toHaveLength(1);
      expect(tables.admin_audit_log.rows).toHaveLength(1);
    });
  });

  describe('updateCRMTask', () => {
    it('validates UUID and input fields correctly', async () => {
      const res = await updateCRMTask({ id: 'invalid-uuid', title: 'Test' });
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('reports database error on failed update', async () => {
      tables.crm_tasks = { error: { message: 'task update failed' } };
      tables.admin_audit_log = { rows: [] };
      const res = await updateCRMTask({
        id: '11111111-2222-4333-8444-555555555555',
        title: 'New Title',
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('task update failed');
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        action: 'crm.task.update',
        outcome: 'failure',
        error: 'task update failed',
      });
    });

    it('reports a task that no longer exists', async () => {
      tables.crm_tasks = { rows: [] };
      const res = await updateCRMTask({
        id: '11111111-2222-4333-8444-555555555555',
        title: 'New Title',
      });
      expect(res).toEqual({ success: false, error: 'That follow-up no longer exists' });
    });

    it('updates an existing task with done status and all fields', async () => {
      tables.crm_tasks = {
        rows: [{ id: '11111111-2222-4333-8444-555555555555', title: 'Old Title', status: 'open' }],
      };
      tables.admin_audit_log = { rows: [] };
      const res = await updateCRMTask({
        id: '11111111-2222-4333-8444-555555555555',
        contactId: '22222222-3333-4444-8555-666666666666',
        title: 'New Title',
        details: 'Details text',
        dueAt: '2026-11-01',
        status: 'done',
      });
      expect(res.success).toBe(true);
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        action: 'crm.task.update',
        target_id: '11111111-2222-4333-8444-555555555555',
        outcome: 'success',
        after: { title: 'New Title', status: 'done' },
      });
    });

    it('updates task with open status', async () => {
      tables.crm_tasks = {
        rows: [{ id: '11111111-2222-4333-8444-555555555555', title: 'Old Title', status: 'done' }],
      };
      const res = await updateCRMTask({
        id: '11111111-2222-4333-8444-555555555555',
        title: 'Reopened Title',
        status: 'open',
      });
      expect(res.success).toBe(true);
    });

    it('clears optional fields when null values are passed', async () => {
      tables.crm_tasks = {
        rows: [
          {
            id: '11111111-2222-4333-8444-555555555555',
            title: 'Old Title',
            status: 'done',
            details: 'Old details',
            due_at: '2026-10-10',
            contact_id: '22222222-3333-4444-8555-666666666666',
          },
        ],
      };
      const res = await updateCRMTask({
        id: '11111111-2222-4333-8444-555555555555',
        details: null,
        dueAt: null,
        contactId: null,
      });
      expect(res.success).toBe(true);
    });
  });

  describe('task audit-loss warnings', () => {
    const taskId = '11111111-2222-4333-8444-555555555555';

    it('warns when a created follow-up could not be audited', async () => {
      tables.crm_tasks = { rows: [], insert: { id: 'task-1' } };
      failAuditWrites();

      const res = await addCRMTask({ title: 'Call the clerk' });

      expect(res).toEqual({
        success: true,
        taskId: 'task-1',
        warning: `The follow-up was created, but ${CRM_AUDIT_LOST_DETAIL}`,
      });
    });

    it('warns when a status change could not be audited', async () => {
      tables.crm_tasks = {
        rows: [{ id: taskId, contact_id: 'c-1', title: 'Call', status: 'open' }],
      };
      failAuditWrites();

      const res = await setCRMTaskStatus({ id: taskId, status: 'done' });

      expect(res).toEqual({
        success: true,
        warning: `The follow-up status was updated, but ${CRM_AUDIT_LOST_DETAIL}`,
      });
    });

    it('warns when a deleted follow-up could not be audited', async () => {
      tables.crm_tasks = { rows: [{ id: taskId, contact_id: 'c-1', title: 'Call' }] };
      failAuditWrites();

      const res = await deleteCRMTask(taskId);

      expect(res).toEqual({
        success: true,
        warning: `The follow-up was deleted, but ${CRM_AUDIT_LOST_DETAIL}`,
      });
    });

    it('warns when an updated follow-up could not be audited', async () => {
      tables.crm_tasks = { rows: [{ id: taskId, title: 'Old', status: 'open' }] };
      failAuditWrites();

      const res = await updateCRMTask({ id: taskId, title: 'New' });

      expect(res).toEqual({
        success: true,
        warning: `The follow-up was updated, but ${CRM_AUDIT_LOST_DETAIL}`,
      });
    });
  });

  describe('updateCRMNote & deleteCRMNote', () => {
    it('refuses to update a note with an empty title', async () => {
      const res = await updateCRMNote({
        activityId: 'act-1',
        title: '   ',
        description: 'Details',
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Title is required');
    });

    it('reports database error on failed note update', async () => {
      tables.crm_activities = { error: { message: 'note update failed' } };
      const res = await updateCRMNote({
        activityId: 'act-1',
        title: 'Updated Note',
        description: 'New details',
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('note update failed');
    });

    it('reports a note that no longer exists', async () => {
      tables.crm_activities = { rows: [] };
      const res = await updateCRMNote({
        activityId: 'act-1',
        title: 'Updated Note',
        description: 'New details',
      });
      expect(res).toEqual({ success: false, error: 'That note no longer exists' });
    });

    it('updates note content when valid', async () => {
      tables.crm_activities = {
        rows: [
          { id: 'act-1', type: 'note', contact_id: 'c1', title: 'Original', description: 'Desc' },
        ],
      };
      const res = await updateCRMNote({
        activityId: 'act-1',
        title: 'Updated Note',
        description: 'New details',
      });
      expect(res.success).toBe(true);
    });

    it('warns when an updated note could not be audited', async () => {
      tables.crm_activities = {
        rows: [
          { id: 'act-1', type: 'note', contact_id: 'c1', title: 'Original', description: 'Desc' },
        ],
      };
      failAuditWrites();

      const res = await updateCRMNote({
        activityId: 'act-1',
        title: 'Updated Note',
        description: 'New details',
      });

      expect(res).toEqual({
        success: true,
        warning: `The note was updated, but ${CRM_AUDIT_LOST_DETAIL}`,
      });
      expect(tables.crm_activities.rows?.[0]?.title).toBe('Updated Note');
    });

    it('sets description to null when blank description is provided', async () => {
      tables.crm_activities = {
        rows: [
          { id: 'act-1', type: 'note', contact_id: 'c1', title: 'Original', description: 'Desc' },
        ],
      };
      const res = await updateCRMNote({
        activityId: 'act-1',
        title: 'Updated Note',
        description: '   ',
      });
      expect(res.success).toBe(true);
    });

    it('reports database error on failed note deletion', async () => {
      tables.crm_activities = { error: { message: 'note delete failed' } };
      const res = await deleteCRMNote('act-1');
      expect(res.success).toBe(false);
      expect(res.error).toBe('note delete failed');
    });

    it('deletes a note cleanly', async () => {
      tables.crm_activities = {
        rows: [
          { id: 'act-1', type: 'note', contact_id: 'c1', title: 'Original', description: 'Desc' },
        ],
      };
      const res = await deleteCRMNote('act-1');
      expect(res.success).toBe(true);
    });

    it('warns when a deleted note could not be audited', async () => {
      tables.crm_activities = {
        rows: [
          { id: 'act-1', type: 'note', contact_id: 'c1', title: 'Original', description: 'Desc' },
        ],
      };
      failAuditWrites();

      const res = await deleteCRMNote('act-1');

      expect(res).toEqual({
        success: true,
        warning: `The note was deleted, but ${CRM_AUDIT_LOST_DETAIL}`,
      });
      expect(tables.crm_activities.rows).toEqual([]);
      expect(tables.admin_audit_log.rows).toEqual([]);
      expect(tables.admin_audit_outbox.rows).toEqual([]);
    });

    it('reports a note that no longer exists when deleting', async () => {
      tables.crm_activities = { rows: [] };
      const res = await deleteCRMNote('act-1');
      expect(res).toEqual({ success: false, error: 'That note no longer exists' });
    });
  });

  describe('bulkUpdateCRMContacts & bulkDeleteCRMContacts', () => {
    it('fails bulk update if no contacts are provided', async () => {
      tables.admin_audit_log = { rows: [] };
      const res = await bulkUpdateCRMContacts({ contactIds: [], status: 'supporter' });
      expect(res.success).toBe(false);
      expect(res.error).toBe('No contacts selected');
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        actor_email: session.adminEmail,
        action: 'crm.contact.bulk_update',
        target_id: 'bulk-update',
        outcome: 'failure',
        error: 'No contacts selected',
        metadata: {
          requested_count: 0,
          requested_ids: [],
          changed_fields: ['status'],
        },
      });
    });

    it('rejects an invalid status during bulk update', async () => {
      tables.admin_audit_log = { rows: [] };
      const res = await bulkUpdateCRMContacts({ contactIds: ['c1'], status: 'superhero' });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid status');
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        actor_email: session.adminEmail,
        action: 'crm.contact.bulk_update',
        target_id: 'c1',
        outcome: 'failure',
        error: 'Invalid status',
        metadata: {
          requested_count: 1,
          requested_ids: ['c1'],
          changed_fields: ['status'],
        },
      });
    });

    it('reports error if single direct bulk update query fails', async () => {
      tables.crm_contacts = {
        rows: [
          { id: 'c1', status: 'supporter', tags: [] },
          { id: 'c2', status: 'supporter', tags: [] },
        ],
        updateError: { message: 'direct update failed' },
      };
      tables.admin_audit_log = { rows: [] };
      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1', 'c2'],
        status: 'supporter',
        district: 'District 3',
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('direct update failed');
      expect(tables.admin_audit_log.rows).toHaveLength(1);
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        actor_email: session.adminEmail,
        action: 'crm.contact.bulk_update',
        target_type: 'crm_contact',
        target_id: 'bulk-update',
        target_label: '2 selected contacts',
        outcome: 'failure',
        error: 'direct update failed',
        metadata: {
          requested_count: 2,
          requested_ids: ['c1', 'c2'],
          changed_fields: ['status', 'district'],
        },
      });
      expect(tables.admin_audit_log.rows?.[0]?.metadata).not.toHaveProperty('updated_count');
    });

    it('uses the returned rows when the exact count differs from the pre-read', async () => {
      tables.crm_contacts = {
        rows: [
          { id: 'c1', status: 'supporter', tags: [] },
          { id: 'c2', status: 'supporter', tags: [] },
        ],
        // PostgREST can report a different exact count than the pre-read when
        // another writer touches the same rows. The audit must still name the
        // rows the update returned, not the raw requested ids.
        writeCount: 1,
      };
      tables.admin_audit_log = { rows: [] };

      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1', 'c2'],
        status: 'active_volunteer',
      });

      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(1);
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        action: 'crm.contact.bulk_update',
        outcome: 'success',
        metadata: {
          affected_ids: ['c1', 'c2'],
          updated_count: 1,
        },
      });
      expect(tables.admin_audit_log.rows?.[0]?.after).toMatchObject({
        contact_ids: ['c1', 'c2'],
      });
    });

    it('performs bulk update on contacts without tag changes', async () => {
      tables.crm_contacts = {
        rows: [
          { id: 'c1', status: 'supporter', tags: ['tag1'] },
          { id: 'c2', status: 'supporter', tags: ['tag2'] },
        ],
      };
      tables.admin_audit_log = { rows: [] };
      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1', 'c2'],
        status: 'active_volunteer',
        district: 'District 4',
      });
      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(2);
      expect(tables.admin_audit_log.rows).toHaveLength(1);
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        actor_email: session.adminEmail,
        action: 'crm.contact.bulk_update',
        target_type: 'crm_contact',
        target_id: 'bulk-update',
        target_label: '2 selected contacts',
        before: {
          contact_ids: ['c1', 'c2'],
          contacts: [
            { id: 'c1', status: 'supporter', district: null },
            { id: 'c2', status: 'supporter', district: null },
          ],
        },
        after: {
          contact_ids: ['c1', 'c2'],
          contacts: [
            { id: 'c1', status: 'active_volunteer', district: 'District 4' },
            { id: 'c2', status: 'active_volunteer', district: 'District 4' },
          ],
        },
        mfa_level: 'aal2',
        outcome: 'success',
        metadata: {
          requested_count: 2,
          requested_ids: ['c1', 'c2'],
          affected_count: 2,
          affected_ids: ['c1', 'c2'],
          updated_count: 2,
          changed_fields: ['status', 'district'],
        },
      });
    });

    it('audits only the contacts that existed when part of the direct selection is missing', async () => {
      tables.crm_contacts = {
        rows: [{ id: 'c1', status: 'supporter', tags: [] }],
      };
      tables.admin_audit_log = { rows: [] };
      tables.crm_activities = { rows: [] };

      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1', 'missing'],
        status: 'active_volunteer',
      });

      expect(res).toEqual({ success: true, updatedCount: 1 });
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        actor_email: session.adminEmail,
        action: 'crm.contact.bulk_update',
        outcome: 'success',
        before: {
          contact_ids: ['c1'],
          contacts: [{ id: 'c1', status: 'supporter' }],
        },
        after: {
          contact_ids: ['c1'],
          contacts: [{ id: 'c1', status: 'active_volunteer' }],
        },
        metadata: {
          requested_count: 2,
          requested_ids: ['c1', 'missing'],
          affected_count: 1,
          affected_ids: ['c1'],
          updated_count: 1,
          changed_fields: ['status'],
        },
      });
      expect(tables.crm_activities.rows).toEqual([]);
    });

    it('counts a repeated selected ID once', async () => {
      tables.crm_contacts = {
        rows: [{ id: 'c1', status: 'supporter', tags: [] }],
      };
      tables.admin_audit_log = { rows: [] };

      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1', 'c1'],
        status: 'active_volunteer',
      });

      expect(res).toEqual({ success: true, updatedCount: 1 });
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        target_id: 'c1',
        target_label: '1 selected contact',
        metadata: {
          requested_count: 1,
          requested_ids: ['c1'],
          affected_count: 1,
          affected_ids: ['c1'],
          updated_count: 1,
          changed_fields: ['status'],
        },
      });
    });

    it('does not update when the pre-write snapshot read fails', async () => {
      tables.crm_contacts = {
        rows: [{ id: 'c1', status: 'supporter', tags: [] }],
        error: { message: 'snapshot unavailable' },
      };
      tables.admin_audit_log = { rows: [] };
      tables.crm_activities = { rows: [] };

      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1'],
        status: 'active_volunteer',
      });

      expect(res).toEqual({ success: false, error: 'snapshot unavailable' });
      expect(tables.crm_contacts.rows?.[0]?.status).toBe('supporter');
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        actor_email: session.adminEmail,
        action: 'crm.contact.bulk_update',
        outcome: 'failure',
        error: 'snapshot unavailable',
        metadata: {
          requested_count: 1,
          requested_ids: ['c1'],
          changed_fields: ['status'],
        },
      });
      expect(tables.admin_audit_log.rows?.[0]?.metadata).not.toHaveProperty('updated_count');
      expect(tables.admin_audit_log.rows?.[0]?.metadata).not.toHaveProperty('affected_count');
      expect(tables.crm_activities.rows).toEqual([]);
    });

    it('succeeds without a warning when the bulk update audit row is queued for retry', async () => {
      tables.crm_contacts = {
        rows: [
          { id: 'c1', status: 'supporter', tags: [] },
          { id: 'c2', status: 'supporter', tags: [] },
        ],
      };
      tables.admin_audit_log = {
        rows: [],
        insertError: { message: 'audit table offline' },
      };
      tables.admin_audit_outbox = { rows: [] };

      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1', 'c2'],
        status: 'active_volunteer',
      });

      expect(res).toEqual({
        success: true,
        updatedCount: 2,
      });
      expect(tables.crm_contacts.rows).toMatchObject([
        { id: 'c1', status: 'active_volunteer' },
        { id: 'c2', status: 'active_volunteer' },
      ]);
      expect(tables.admin_audit_log.rows).toEqual([]);
      expect(tables.admin_audit_outbox.rows).toHaveLength(1);
      expect(tables.admin_audit_outbox.rows?.[0]).toMatchObject({
        payload: {
          action: 'crm.contact.bulk_update',
          target_type: 'crm_contact',
          target_id: 'bulk-update',
          outcome: 'success',
          metadata: {
            requested_count: 2,
            updated_count: 2,
            changed_fields: ['status'],
          },
        },
        last_error: 'audit table offline',
      });
    });

    it('reports the stronger warning when neither the audit log nor the outbox accepts the record', async () => {
      tables.crm_contacts = {
        rows: [{ id: 'c1', status: 'supporter', tags: [] }],
      };
      tables.admin_audit_log = {
        rows: [],
        insertError: { message: 'audit table offline' },
      };
      tables.admin_audit_outbox = {
        rows: [],
        insertError: { message: 'outbox offline' },
      };

      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1'],
        status: 'active_volunteer',
      });

      expect(res).toEqual({
        success: true,
        updatedCount: 1,
        warning: `The bulk update succeeded, but ${CRM_AUDIT_LOST_DETAIL}`,
      });
      expect(tables.admin_audit_outbox.rows).toEqual([]);
    });

    it('queues the audit after a successful tag bulk update without warning', async () => {
      tables.crm_contacts = {
        rows: [{ id: 'c1', status: 'supporter', tags: ['old'] }],
      };
      tables.admin_audit_log = {
        rows: [],
        insertError: { message: 'audit table offline' },
      };
      tables.admin_audit_outbox = { rows: [] };

      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1'],
        addTags: ['new-tag'],
        removeTags: ['old'],
      });

      expect(res).toEqual({
        success: true,
        updatedCount: 1,
      });
      expect(tables.crm_contacts.rows?.[0]?.tags).toEqual(['new-tag']);
      expect(tables.admin_audit_log.rows).toEqual([]);
      expect(tables.admin_audit_outbox.rows).toHaveLength(1);
      expect(tables.admin_audit_outbox.rows?.[0]).toMatchObject({
        payload: {
          action: 'crm.contact.bulk_update',
          outcome: 'success',
          metadata: { changed_fields: ['tags'], updated_count: 1 },
        },
      });
    });

    it('does not report zero when a direct bulk update omits its count', async () => {
      tables.crm_contacts = {
        rows: [{ id: 'c1', status: 'supporter', tags: [] }],
        writeCount: null,
      };
      tables.admin_audit_log = { rows: [] };

      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1'],
        status: 'active_volunteer',
      });

      expect(res).toEqual({ success: true });
      expect(tables.crm_contacts.rows?.[0]?.status).toBe('active_volunteer');
      // The audit record must not turn an unavailable count into a zero either.
      expect(tables.admin_audit_log.rows?.[0]?.metadata).toEqual({
        requested_count: 1,
        requested_ids: ['c1'],
        affected_count: 1,
        affected_ids: ['c1'],
        changed_fields: ['status'],
        field_changes: {
          status: [{ contact_id: 'c1', old_value: 'supporter', new_value: 'active_volunteer' }],
        },
      });
    });

    it('does not fabricate an after snapshot when the update response omits a row', async () => {
      tables.crm_contacts = {
        rows: [
          { id: 'c1', status: 'supporter', tags: [] },
          { id: 'c2', status: 'supporter', tags: [] },
        ],
        // The write applies to both rows, but the representation is partial.
        omitUpdateResponseIds: ['c2'],
      };
      tables.admin_audit_log = { rows: [] };

      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1', 'c2'],
        status: 'active_volunteer',
      });

      expect(res).toEqual({ success: true, updatedCount: 2 });
      // The missing response row was updated; only the audit after-snapshot omits it.
      expect(tables.crm_contacts.rows).toMatchObject([
        { id: 'c1', status: 'active_volunteer' },
        { id: 'c2', status: 'active_volunteer' },
      ]);
      const audit = tables.admin_audit_log.rows?.[0];
      expect(audit).toMatchObject({
        action: 'crm.contact.bulk_update',
        outcome: 'success',
        before: {
          contact_ids: ['c1', 'c2'],
          contacts: [
            { id: 'c1', status: 'supporter' },
            { id: 'c2', status: 'supporter' },
          ],
        },
        metadata: {
          requested_count: 2,
          requested_ids: ['c1', 'c2'],
          affected_count: 2,
          affected_ids: ['c1', 'c2'],
          updated_count: 2,
          changed_fields: ['status'],
          field_changes: {
            status: [{ contact_id: 'c1', old_value: 'supporter', new_value: 'active_volunteer' }],
          },
        },
      });
      // Do not project `before + payload` for c2; only the returned row is evidence.
      expect(audit?.after).toEqual({
        contact_ids: ['c1'],
        contacts: [{ id: 'c1', status: 'active_volunteer' }],
      });
    });

    it('reports when no selected contacts remain for a direct bulk update', async () => {
      tables.crm_contacts = { rows: [] };
      tables.admin_audit_log = { rows: [] };
      const res = await bulkUpdateCRMContacts({ contactIds: ['c1'], status: 'supporter' });
      expect(res).toEqual({
        success: false,
        error: 'None of the selected constituents still exist',
      });
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        actor_email: session.adminEmail,
        action: 'crm.contact.bulk_update',
        outcome: 'failure',
        error: 'None of the selected constituents still exist',
        metadata: {
          requested_count: 1,
          requested_ids: ['c1'],
          updated_count: 0,
          changed_fields: ['status'],
        },
      });
    });

    it('rejects an invalid consent value during bulk update', async () => {
      tables.admin_audit_log = { rows: [] };
      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1'],
        consent: 'sometimes' as unknown as 'opted_in',
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid consent value');
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        outcome: 'failure',
        error: 'Invalid consent value',
        metadata: { requested_ids: ['c1'], changed_fields: ['consent'] },
      });
    });

    it('rejects bulk-added tags the single-contact schema would refuse', async () => {
      tables.crm_contacts = {
        rows: [{ id: 'c1', status: 'supporter', tags: [] }],
      };
      tables.admin_audit_log = { rows: [] };
      for (const bad of ['has,comma', '<b>bold</b>', `x${'y'.repeat(60)}`]) {
        const res = await bulkUpdateCRMContacts({ contactIds: ['c1'], addTags: [bad] });
        expect(res.success).toBe(false);
        expect(res.error ?? '').toMatch(/^Invalid tag "/);
      }
      // Nothing was written: the refusal happens before the directory is read.
      expect(tables.crm_contacts.rows).toEqual([{ id: 'c1', status: 'supporter', tags: [] }]);
      expect(tables.admin_audit_log.rows).toHaveLength(3);
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        outcome: 'failure',
        metadata: { requested_count: 1, requested_ids: ['c1'], changed_fields: ['tags'] },
      });
    });

    it('still removes tags that would fail the add-shape check', async () => {
      // A legacy row can carry a tag this rule predates. Refusing it here
      // would strand the row — removal matches case-insensitively and removes
      // unconditionally.
      tables.crm_contacts = {
        rows: [{ id: 'c1', status: 'supporter', tags: ['has,comma', 'Choir'] }],
      };
      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1'],
        removeTags: ['has,comma', 'choir'],
      });
      expect(res.success).toBe(true);
      expect((tables.crm_contacts.rows as { tags: string[] }[])[0].tags).toEqual([]);
    });

    it('bulk-opts contacts out, writing do_not_email and unsubscribed_at', async () => {
      tables.crm_contacts = {
        rows: [
          { id: 'c1', status: 'supporter', tags: [], do_not_email: false },
          { id: 'c2', status: 'supporter', tags: [], do_not_email: false },
        ],
      };
      tables.admin_audit_log = { rows: [] };
      const res = await bulkUpdateCRMContacts({ contactIds: ['c1', 'c2'], consent: 'opted_out' });
      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(2);
      for (const row of tables.crm_contacts.rows as { do_not_email: boolean | null }[]) {
        expect(row.do_not_email).toBe(true);
      }
      expect(tables.admin_audit_log.rows).toHaveLength(1);
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        action: 'crm.contact.bulk_update',
        outcome: 'success',
        metadata: {
          requested_count: 2,
          updated_count: 2,
          changed_fields: ['consent'],
        },
      });
    });

    it('bulk-marks contacts unasked, writing do_not_email NULL', async () => {
      tables.crm_contacts = {
        rows: [{ id: 'c1', status: 'supporter', tags: [], do_not_email: true }],
      };
      const res = await bulkUpdateCRMContacts({ contactIds: ['c1'], consent: 'unasked' });
      expect(res.success).toBe(true);
      const rows = tables.crm_contacts.rows as { do_not_email: boolean | null }[];
      expect(rows[0].do_not_email).toBeNull();
    });

    it('reports error when fetching contacts for tag modifications fails', async () => {
      tables.crm_contacts = { error: { message: 'fetch contacts failed' } };
      tables.admin_audit_log = { rows: [] };
      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1'],
        addTags: ['new-tag'],
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('fetch contacts failed');
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        actor_email: session.adminEmail,
        action: 'crm.contact.bulk_update',
        outcome: 'failure',
        error: 'fetch contacts failed',
        metadata: {
          requested_count: 1,
          requested_ids: ['c1'],
          changed_fields: ['tags'],
        },
      });
      expect(tables.admin_audit_log.rows?.[0]?.metadata).not.toHaveProperty('updated_count');
    });

    it('reports when no selected contacts remain for a tag update', async () => {
      tables.crm_contacts = { rows: [] };
      tables.admin_audit_log = { rows: [] };
      const res = await bulkUpdateCRMContacts({ contactIds: ['c1'], addTags: ['new-tag'] });
      expect(res).toEqual({
        success: false,
        error: 'None of the selected constituents still exist',
      });
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        actor_email: session.adminEmail,
        action: 'crm.contact.bulk_update',
        outcome: 'failure',
        error: 'None of the selected constituents still exist',
        metadata: {
          requested_count: 1,
          requested_ids: ['c1'],
          updated_count: 0,
          changed_fields: ['tags'],
        },
      });
    });

    it('reports the count actually updated when part of the tag selection is gone', async () => {
      tables.crm_contacts = {
        rows: [{ id: 'c1', status: 'supporter', tags: [] }],
      };
      tables.admin_audit_log = { rows: [] };
      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1', 'c2'],
        addTags: ['new-tag'],
      });
      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(1);
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        action: 'crm.contact.bulk_update',
        outcome: 'success',
        before: {
          contact_ids: ['c1'],
          contacts: [{ id: 'c1', tags: [] }],
        },
        after: {
          contact_ids: ['c1'],
          contacts: [{ id: 'c1', tags: ['new-tag'] }],
        },
        metadata: {
          requested_count: 2,
          affected_count: 1,
          affected_ids: ['c1'],
          updated_count: 1,
          changed_fields: ['tags'],
        },
      });
    });

    it('reports a per-contact update failure instead of reporting success', async () => {
      tables.crm_contacts = {
        rows: [{ id: 'c1', status: 'supporter', tags: ['old'] }],
        errors: [
          {
            kind: 'eq',
            column: 'id',
            error: { message: 'connection reset' },
          },
        ],
      };
      tables.admin_audit_log = { rows: [] };
      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1'],
        addTags: ['new-tag'],
      });

      expect(res).toMatchObject({ success: false, updatedCount: 0 });
      expect(res.error).toContain('connection reset');
      expect(tables.crm_contacts.rows?.[0]).toMatchObject({ tags: ['old'] });
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        actor_email: session.adminEmail,
        action: 'crm.contact.bulk_update',
        outcome: 'failure',
        error: expect.stringContaining('connection reset'),
        metadata: {
          requested_count: 1,
          requested_ids: ['c1'],
          updated_count: 0,
          changed_fields: ['tags'],
        },
      });
    });

    it('reports a partial tag failure against the requested selection, not the found count', async () => {
      let updates = 0;
      const contacts: MockTableConfig = {
        rows: [
          { id: 'c1', status: 'supporter', tags: [] },
          { id: 'c2', status: 'supporter', tags: [] },
        ],
        onUpdate: () => {
          updates += 1;
          if (updates === 1) {
            contacts.errors = [
              { kind: 'eq', column: 'id', error: { message: 'connection reset' } },
            ];
          }
        },
      };
      tables.crm_contacts = contacts;
      tables.admin_audit_log = { rows: [] };
      tables.crm_activities = { rows: [] };

      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1', 'c2'],
        addTags: ['new-tag'],
      });

      expect(res.success).toBe(false);
      expect(res.updatedCount).toBe(1);
      expect(res.error).toContain('1 of 2 selected contacts');
      expect(tables.crm_contacts.rows?.[0]?.tags).toEqual(['new-tag']);
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        actor_email: session.adminEmail,
        action: 'crm.contact.bulk_update',
        outcome: 'failure',
        error: expect.stringContaining('1 of 2 selected contacts'),
        before: {
          contact_ids: ['c1'],
          contacts: [{ id: 'c1', tags: [] }],
        },
        after: {
          contact_ids: ['c1'],
          contacts: [{ id: 'c1', tags: ['new-tag'] }],
        },
        metadata: {
          requested_count: 2,
          requested_ids: ['c1', 'c2'],
          affected_count: 1,
          affected_ids: ['c1'],
          updated_count: 1,
          changed_fields: ['tags'],
        },
      });
      expect(tables.crm_activities.rows).toEqual([]);
    });

    it('reports a partial disappearance against the requested selection', async () => {
      let updates = 0;
      const contacts: MockTableConfig = {
        rows: [
          { id: 'c1', status: 'supporter', tags: [] },
          { id: 'c2', status: 'supporter', tags: [] },
        ],
        onUpdate: () => {
          updates += 1;
          if (updates === 1) contacts.rows = [];
        },
      };
      tables.crm_contacts = contacts;
      tables.admin_audit_log = { rows: [] };

      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1', 'c2'],
        addTags: ['new-tag'],
      });

      expect(res).toMatchObject({
        success: false,
        updatedCount: 1,
        error:
          'A selected contact no longer exists after 1 of 2 selected contacts were updated; the rest were not.',
      });
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        action: 'crm.contact.bulk_update',
        outcome: 'failure',
        metadata: {
          requested_count: 2,
          requested_ids: ['c1', 'c2'],
          affected_count: 1,
          affected_ids: ['c1'],
          updated_count: 1,
          changed_fields: ['tags'],
        },
      });
    });

    it('audits a per-contact disappearance instead of reporting success', async () => {
      tables.crm_contacts = {
        rows: [{ id: 'c1', status: 'supporter', tags: [] }],
        beforeUpdate: () => {
          tables.crm_contacts.rows = [];
        },
      };
      tables.admin_audit_log = { rows: [] };
      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1'],
        addTags: ['new-tag'],
      });

      expect(res).toMatchObject({
        success: false,
        updatedCount: 0,
        error: 'A selected contact no longer exists',
      });
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        actor_email: session.adminEmail,
        action: 'crm.contact.bulk_update',
        outcome: 'failure',
        error: 'A selected contact no longer exists',
        metadata: {
          requested_count: 1,
          requested_ids: ['c1'],
          updated_count: 0,
          changed_fields: ['tags'],
        },
      });
    });

    it('adds and removes tags in bulk across contacts', async () => {
      tables.crm_contacts = {
        rows: [
          { id: 'c1', status: 'supporter', tags: ['volunteer', 'donor'] },
          { id: 'c2', status: 'supporter', tags: ['donor', 'phonebank'] },
        ],
      };
      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1', 'c2'],
        status: 'active_volunteer',
        district: 'District 1',
        addTags: ['canvasser', 'donor'],
        removeTags: ['phonebank'],
      });
      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(2);
    });

    it('records one operation audit with requested IDs for all four bulk fields', async () => {
      tables.crm_contacts = {
        rows: [
          { id: 'c1', status: 'supporter', tags: ['old'], do_not_email: false },
          { id: 'c2', status: 'supporter', tags: ['old'], do_not_email: false },
        ],
      };
      tables.admin_audit_log = { rows: [] };
      tables.crm_activities = { rows: [] };

      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1', 'c2'],
        status: 'active_volunteer',
        district: 'CA-06',
        consent: 'opted_out',
        addTags: ['new-tag'],
        removeTags: ['old'],
      });

      expect(res).toEqual({ success: true, updatedCount: 2 });
      expect(tables.admin_audit_log.rows).toHaveLength(1);
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        actor_email: session.adminEmail,
        action: 'crm.contact.bulk_update',
        target_type: 'crm_contact',
        target_id: 'bulk-update',
        target_label: '2 selected contacts',
        outcome: 'success',
        metadata: {
          requested_count: 2,
          requested_ids: ['c1', 'c2'],
          affected_count: 2,
          affected_ids: ['c1', 'c2'],
          updated_count: 2,
          changed_fields: ['status', 'district', 'tags', 'consent'],
          field_changes: {
            status: [
              {
                contact_id: 'c1',
                old_value: 'supporter',
                new_value: 'active_volunteer',
              },
              {
                contact_id: 'c2',
                old_value: 'supporter',
                new_value: 'active_volunteer',
              },
            ],
            district: [
              { contact_id: 'c1', old_value: null, new_value: 'CA-06' },
              { contact_id: 'c2', old_value: null, new_value: 'CA-06' },
            ],
            tags: [
              { contact_id: 'c1', old_value: ['old'], new_value: ['new-tag'] },
              { contact_id: 'c2', old_value: ['old'], new_value: ['new-tag'] },
            ],
            consent: [
              {
                contact_id: 'c1',
                old_value: {
                  decision: 'opted_in',
                  do_not_email: false,
                  unsubscribed_at: null,
                },
                new_value: {
                  decision: 'opted_out',
                  do_not_email: true,
                  unsubscribed_at: expect.any(String),
                },
              },
              {
                contact_id: 'c2',
                old_value: {
                  decision: 'opted_in',
                  do_not_email: false,
                  unsubscribed_at: null,
                },
                new_value: {
                  decision: 'opted_out',
                  do_not_email: true,
                  unsubscribed_at: expect.any(String),
                },
              },
            ],
          },
        },
        before: {
          contact_ids: ['c1', 'c2'],
          contacts: [
            {
              id: 'c1',
              status: 'supporter',
              district: null,
              tags: ['old'],
              do_not_email: false,
              unsubscribed_at: null,
            },
            {
              id: 'c2',
              status: 'supporter',
              district: null,
              tags: ['old'],
              do_not_email: false,
              unsubscribed_at: null,
            },
          ],
        },
        after: {
          contact_ids: ['c1', 'c2'],
          contacts: [
            {
              id: 'c1',
              status: 'active_volunteer',
              district: 'CA-06',
              tags: ['new-tag'],
              do_not_email: true,
              unsubscribed_at: expect.any(String),
            },
            {
              id: 'c2',
              status: 'active_volunteer',
              district: 'CA-06',
              tags: ['new-tag'],
              do_not_email: true,
              unsubscribed_at: expect.any(String),
            },
          ],
        },
      });
      // The operation audit replaces per-contact timeline rows, which would
      // flood the activity history on a large selection.
      expect(tables.crm_activities.rows).toEqual([]);
    });

    it('handles contacts with null or empty tags when adding tags', async () => {
      tables.crm_contacts = {
        rows: [
          { id: 'c1', status: 'supporter', tags: null },
          { id: 'c2', status: 'supporter', tags: [] },
        ],
      };
      tables.admin_audit_log = { rows: [] };
      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1', 'c2'],
        addTags: ['fresh-tag'],
      });
      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(2);
      expect(tables.admin_audit_log.rows).toHaveLength(1);
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        action: 'crm.contact.bulk_update',
        outcome: 'success',
        metadata: {
          requested_count: 2,
          updated_count: 2,
          changed_fields: ['tags'],
        },
      });
    });

    it('removes tags without adding tags when only removeTags is specified', async () => {
      tables.crm_contacts = {
        rows: [{ id: 'c1', status: 'supporter', tags: ['keep', 'drop'] }],
      };
      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1'],
        removeTags: ['drop'],
      });
      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(1);
    });

    it('fails bulk delete if no contacts are provided', async () => {
      const res = await bulkDeleteCRMContacts([]);
      expect(res.success).toBe(false);
      expect(res.error).toBe('No contacts selected');
    });

    it('reports error if bulk delete query fails', async () => {
      tables.crm_contacts = { error: { message: 'bulk delete failed' } };
      const res = await bulkDeleteCRMContacts(['c1', 'c2']);
      expect(res.success).toBe(false);
      expect(res.error).toBe('bulk delete failed');
    });

    it('deletes multiple contacts cleanly', async () => {
      tables.crm_contacts = {
        rows: [
          { id: 'c1', email: 'a@b.co' },
          { id: 'c2', email: 'c@d.co' },
        ],
      };
      tables.admin_audit_log = { rows: [] };
      const res = await bulkDeleteCRMContacts(['c1', 'c2']);
      expect(res.success).toBe(true);
      expect(res.deletedCount).toBe(2);
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        actor_user_id: session.adminUserId,
        action: 'crm.contact.bulk_delete',
        target_type: 'crm_contact',
        target_id: 'bulk-delete',
        target_label: '2 selected contacts',
        before: {
          contact_ids: ['c1', 'c2'],
          contacts: [
            { id: 'c1', email: 'a@b.co' },
            { id: 'c2', email: 'c@d.co' },
          ],
        },
        after: {
          contact_ids: ['c1', 'c2'],
          contacts: [
            { id: 'c1', deleted: true },
            { id: 'c2', deleted: true },
          ],
        },
        outcome: 'success',
        metadata: {
          requested_count: 2,
          requested_ids: ['c1', 'c2'],
          affected_count: 2,
          affected_ids: ['c1', 'c2'],
          deleted_count: 2,
        },
      });
    });

    it('records only the contacts the delete actually removed', async () => {
      tables.crm_contacts = {
        rows: [{ id: 'c1', email: 'a@b.co', first_name: 'Ada', last_name: 'A' }],
      };
      tables.admin_audit_log = { rows: [] };

      const res = await bulkDeleteCRMContacts(['c1', 'missing']);

      expect(res).toEqual({ success: true, deletedCount: 1 });
      expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
        before: {
          contact_ids: ['c1'],
          contacts: [{ id: 'c1', email: 'a@b.co', first_name: 'Ada', last_name: 'A' }],
        },
        after: {
          contact_ids: ['c1'],
          contacts: [{ id: 'c1', deleted: true }],
        },
        metadata: {
          requested_count: 2,
          requested_ids: ['c1', 'missing'],
          affected_count: 1,
          affected_ids: ['c1'],
          deleted_count: 1,
        },
      });
    });

    it('succeeds without a warning when the bulk delete audit row is queued for retry', async () => {
      tables.crm_contacts = {
        rows: [
          { id: 'c1', email: 'a@b.co' },
          { id: 'c2', email: 'c@d.co' },
        ],
      };
      tables.admin_audit_log = {
        rows: [],
        insertError: { message: 'audit table offline' },
      };
      tables.admin_audit_outbox = { rows: [] };

      const res = await bulkDeleteCRMContacts(['c1', 'c2']);

      expect(res).toEqual({
        success: true,
        deletedCount: 2,
      });
      expect(tables.crm_contacts.rows).toEqual([]);
      expect(tables.admin_audit_log.rows).toEqual([]);
      expect(tables.admin_audit_outbox.rows).toHaveLength(1);
      expect(tables.admin_audit_outbox.rows?.[0]).toMatchObject({
        payload: {
          action: 'crm.contact.bulk_delete',
          outcome: 'success',
          metadata: { requested_count: 2, deleted_count: 2 },
        },
      });
    });

    it('warns when a bulk delete could not be audited', async () => {
      tables.crm_contacts = {
        rows: [
          { id: 'c1', email: 'a@b.co' },
          { id: 'c2', email: 'c@d.co' },
        ],
      };
      failAuditWrites();

      const res = await bulkDeleteCRMContacts(['c1', 'c2']);

      expect(res).toEqual({
        success: true,
        deletedCount: 2,
        warning: `The bulk delete succeeded, but ${CRM_AUDIT_LOST_DETAIL}`,
      });
      expect(tables.crm_contacts.rows).toEqual([]);
      expect(tables.admin_audit_log.rows).toEqual([]);
      expect(tables.admin_audit_outbox.rows).toEqual([]);
    });

    it('does not report zero when a bulk delete omits its count', async () => {
      tables.crm_contacts = {
        rows: [{ id: 'c1', email: 'a@b.co' }],
        writeCount: null,
      };

      const res = await bulkDeleteCRMContacts(['c1']);

      expect(res).toEqual({ success: true });
      expect(tables.crm_contacts.rows).toHaveLength(0);
    });

    it('reports when no selected contacts remain for a bulk delete', async () => {
      tables.crm_contacts = { rows: [] };
      const res = await bulkDeleteCRMContacts(['c1', 'c2']);
      expect(res).toEqual({
        success: false,
        error: 'None of the selected constituents still exist',
      });
    });
  });
});
