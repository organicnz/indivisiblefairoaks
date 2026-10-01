import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
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
  deleteCRMContact,
  importCRMContacts,
  mergeCRMContacts,
  saveCRMContact,
  sendCRMDirectEmail,
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
    });

    it('reports a merge whose second step failed', async () => {
      // The first step has already moved activities by the time a later call
      // fails, so the operator needs to know the merge is half-applied rather
      // than being told it worked. The failure is on the activities update, so
      // `crm_activities` carries the error and the rest behave.
      tables.crm_contacts = { rows: [{ id: 'keep-1' }, { id: 'dup-1' }] };
      tables.crm_activities = {
        rows: [{ id: 'a1', contact_id: 'dup-1' }],
        error: { message: 'fk violation' },
      };
      tables.crm_tasks = { rows: [] };

      const res = await mergeCRMContacts({ keepId: 'keep-1', removeId: 'dup-1' });

      expect(res.success).toBe(false);
      expect(res.error).toBeTruthy();
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
});
