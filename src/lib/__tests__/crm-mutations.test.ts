import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  })),
}));

import {
  addCRMNote,
  bulkDeleteCRMContacts,
  bulkUpdateCRMContacts,
  deleteCRMContact,
  deleteCRMNote,
  importCRMContacts,
  mergeCRMContacts,
  saveCRMContact,
  sendCRMDirectEmail,
  updateCRMNote,
  updateCRMTask,
} from '@/lib/actions/crm';
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
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as typeof fetch;
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

    it('rejects an email that is not an email before touching the database', async () => {
      const res = await saveCRMContact({ email: 'not-an-email', first_name: 'Robin' });
      expect(res.success).toBe(false);
      expect(mockAdminClient.from).not.toHaveBeenCalled();
    });

    it('surfaces a duplicate email as a sentence rather than a Postgres code', async () => {
      // 23505 is what the database says. "That email is already in the
      // directory" is what the volunteer needs.
      tables.crm_contacts = { rows: [], error: { code: '23505', message: 'duplicate key' } };

      const res = await saveCRMContact({
        id: '11111111-2222-4333-8444-555555555555',
        email: 'a@b.co',
        first_name: 'Robin',
      });

      expect(res.success).toBe(false);
      expect(res.error).not.toMatch(/23505/);
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
      tables.crm_contacts = { rows: [{ id: '11111111-2222-4333-8444-555555555555' }] };

      await expect(deleteCRMContact('11111111-2222-4333-8444-555555555555')).resolves.toEqual({
        success: true,
      });
      expect(tables.crm_contacts.rows).toHaveLength(0);
    });

    it('reports success for a row that was already gone, without failing the delete', async () => {
      // PostgREST deletes zero rows and reports no error, so the action cannot
      // distinguish "deleted" from "was not there". It must not invent an error.
      tables.crm_contacts = { rows: [] };

      await expect(deleteCRMContact('missing')).resolves.toEqual({ success: true });
    });
  });

  describe('addCRMNote', () => {
    it('refuses a note with no title', async () => {
      const res = await addCRMNote({ contactId: 'c1', title: '   ', description: '' });
      expect(res.success).toBe(false);
      expect(mockAdminClient.from).not.toHaveBeenCalled();
    });

    it('trims the title so the timeline is not full of padded headings', async () => {
      const inserted: Record<string, unknown>[] = [];
      tables.crm_activities = { rows: [], insert: {}, onInsert: (row) => inserted.push(row) };

      await addCRMNote({ contactId: 'c1', title: '  Spoke at the fair  ', description: 'body' });

      // The row that reached the database, not the arguments a stub was handed.
      expect(inserted[0]?.title).toBe('Spoke at the fair');
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
  });

  describe('mergeCRMContacts', () => {
    it('refuses to merge a contact into itself', async () => {
      // Otherwise the merge deletes the row it just moved everything onto, and
      // the person is gone from the directory entirely.
      const res = await mergeCRMContacts({ keepId: 'c1', removeId: 'c1' });
      expect(res.success).toBe(false);
      expect(mockAdminClient.from).not.toHaveBeenCalled();
      expect(mockAdminClient.rpc).not.toHaveBeenCalled();
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
      expect(mockAdminClient.from).toHaveBeenCalledTimes(2);
      expect(mockAdminClient.from).toHaveBeenCalledWith('crm_contacts');
    });
  });

  describe('sendCRMDirectEmail', () => {
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
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('surfaces a provider rejection instead of reporting a send', async () => {
      freshAdmin();
      tables.crm_contacts = {
        rows: [{ id: 'c1', email: 'a@b.co', do_not_email: false, first_name: 'Robin' }],
      };
      const activities: Record<string, unknown>[] = [];
      tables.crm_activities = { rows: [], insert: {}, onInsert: (row) => activities.push(row) };
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: async () => '{"message":"domain not verified"}',
        json: async () => ({ message: 'domain not verified' }),
      }) as unknown as typeof fetch;

      const res = await sendCRMDirectEmail({ contactId: 'c1', subject: 'Hi', message: 'There' });

      expect(res.success).toBe(false);
      // The activity row must not claim a delivery that did not happen.
      expect(activities).toHaveLength(0);
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
      global.fetch = vi.fn(async (_url: string, init: { body?: unknown }) => {
        payload = JSON.parse(String(init?.body)) as { text?: string };
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'e1' }),
          text: async () => '{"id":"e1"}',
        };
      }) as unknown as typeof fetch;

      const res = await sendCRMDirectEmail({ contactId: 'c1', subject: 'Hi', message: 'There' });

      expect(res.success).toBe(true);
      expect(payload.text ?? '').not.toContain('https://indivisiblefairoaks.org/');
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
      const res = await updateCRMTask({
        id: '11111111-2222-4333-8444-555555555555',
        title: 'New Title',
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('task update failed');
    });

    it('updates an existing task with done status and all fields', async () => {
      tables.crm_tasks = {
        rows: [{ id: '11111111-2222-4333-8444-555555555555', title: 'Old Title', status: 'open' }],
      };
      const res = await updateCRMTask({
        id: '11111111-2222-4333-8444-555555555555',
        contactId: '22222222-3333-4444-8555-666666666666',
        title: 'New Title',
        details: 'Details text',
        dueAt: '2026-11-01',
        status: 'done',
      });
      expect(res.success).toBe(true);
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

    it('updates note content when valid', async () => {
      tables.crm_activities = {
        rows: [{ id: 'act-1', type: 'note', title: 'Original', description: 'Desc' }],
      };
      const res = await updateCRMNote({
        activityId: 'act-1',
        title: 'Updated Note',
        description: 'New details',
      });
      expect(res.success).toBe(true);
    });

    it('sets description to null when blank description is provided', async () => {
      tables.crm_activities = {
        rows: [{ id: 'act-1', type: 'note', title: 'Original', description: 'Desc' }],
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
        rows: [{ id: 'act-1', type: 'note', title: 'Original', description: 'Desc' }],
      };
      const res = await deleteCRMNote('act-1');
      expect(res.success).toBe(true);
    });
  });

  describe('bulkUpdateCRMContacts & bulkDeleteCRMContacts', () => {
    it('fails bulk update if no contacts are provided', async () => {
      const res = await bulkUpdateCRMContacts({ contactIds: [], status: 'supporter' });
      expect(res.success).toBe(false);
      expect(res.error).toBe('No contacts selected');
    });

    it('rejects an invalid status during bulk update', async () => {
      const res = await bulkUpdateCRMContacts({ contactIds: ['c1'], status: 'superhero' });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid status');
    });

    it('reports error if single direct bulk update query fails', async () => {
      tables.crm_contacts = { error: { message: 'direct update failed' } };
      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1', 'c2'],
        status: 'supporter',
        district: 'District 3',
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('direct update failed');
    });

    it('performs bulk update on contacts without tag changes', async () => {
      tables.crm_contacts = {
        rows: [
          { id: 'c1', status: 'supporter', tags: ['tag1'] },
          { id: 'c2', status: 'supporter', tags: ['tag2'] },
        ],
      };
      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1', 'c2'],
        status: 'active_volunteer',
        district: 'District 4',
      });
      expect(res.success).toBe(true);
    });

    it('rejects an invalid consent value during bulk update', async () => {
      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1'],
        consent: 'sometimes' as unknown as 'opted_in',
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid consent value');
    });

    it('rejects bulk-added tags the single-contact schema would refuse', async () => {
      tables.crm_contacts = {
        rows: [{ id: 'c1', status: 'supporter', tags: [] }],
      };
      for (const bad of ['has,comma', '<b>bold</b>', `x${'y'.repeat(60)}`]) {
        const res = await bulkUpdateCRMContacts({ contactIds: ['c1'], addTags: [bad] });
        expect(res.success).toBe(false);
        expect(res.error ?? '').toMatch(/^Invalid tag "/);
      }
      // Nothing was written: the refusal happens before the directory is read.
      expect(tables.crm_contacts.rows).toEqual([{ id: 'c1', status: 'supporter', tags: [] }]);
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
      const res = await bulkUpdateCRMContacts({ contactIds: ['c1', 'c2'], consent: 'opted_out' });
      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(2);
      for (const row of tables.crm_contacts.rows as { do_not_email: boolean | null }[]) {
        expect(row.do_not_email).toBe(true);
      }
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
      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1'],
        addTags: ['new-tag'],
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('fetch contacts failed');
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

    it('handles contacts with null or empty tags when adding tags', async () => {
      tables.crm_contacts = {
        rows: [
          { id: 'c1', status: 'supporter', tags: null },
          { id: 'c2', status: 'supporter', tags: [] },
        ],
      };
      const res = await bulkUpdateCRMContacts({
        contactIds: ['c1', 'c2'],
        addTags: ['fresh-tag'],
      });
      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(2);
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
      const res = await bulkDeleteCRMContacts(['c1', 'c2']);
      expect(res.success).toBe(true);
    });
  });
});
