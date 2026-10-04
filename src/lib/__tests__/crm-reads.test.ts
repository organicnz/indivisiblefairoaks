import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('server-only', () => ({}));

const session = vi.hoisted(() => ({
  adminUserId: 'admin-user-uuid-1234',
  adminEmail: 'organizer@indivisiblefairoaks.org',
}));

const mockAdminClient = { from: vi.fn(), rpc: vi.fn() };

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
  addCRMTask,
  deleteCRMBroadcastDraft,
  deleteCRMSegment,
  deleteCRMTask,
  getBroadcastProgress,
  getBroadcastRecipientCount,
  getCRMBroadcastDrafts,
  getCRMBroadcasts,
  getCRMContactDetail,
  getCRMContacts,
  getCRMExistingTags,
  getCRMSegments,
  getCRMTasks,
  getCRMTasksForContact,
  previewCRMBroadcast,
  saveCRMSegment,
  setCRMEmailConsent,
  triggerHistoricalCRMSync,
} from '@/lib/actions/crm';
import { env } from '@/lib/env';
import { createMockAdminClient, type MockTableConfig } from './supabase-mock';

const mockEnv = env as unknown as Record<string, string | undefined>;

/**
 * The read and bookkeeping half of the CRM action surface.
 *
 * `src/lib/actions/crm.ts` held every mutation, the dispatch, the rate limits and
 * the e2e guard, and none of it was inside the coverage `include` list — so the
 * 90% gate was measuring a set of files that did not include it. That is how a
 * ceiling refusal stayed dead code and a `created_by` column stayed unwritten
 * while the pipeline stayed green.
 *
 * This file is the reads, so the file is at least honestly measured from here.
 */

/**
 * Row sets per table, rebuilt for each test, over the shared row-based mock.
 *
 * This file used to hand-roll a `createMockQueryBuilder(terminalResult)` and
 * assert on the response it was told to return — `expect(qb.neq.mock.calls[0])
 * .toEqual(['status', 'draft'])` — which cannot tell a correct query from one
 * naming the wrong column. The assertion is satisfied by the stub, not by the
 * rows, and it is exactly the failure that a stub cannot catch: a query that
 * filters `staus` instead of `status` hands the same two arguments to the same
 * mock method and reads fine.
 *
 * Describing the *rows* instead means the query has to actually select them.
 * "Only the sent campaigns came back" is a property of the result; "the `.neq`
 * was called" is a property of the call.
 */
let tables: Record<string, MockTableConfig>;

import type { UnmodelledFilterMethod } from './supabase-mock';

/** Every `.or()` / `.contains()` / `.textSearch()` this test, with its arguments. */
let filterCalls: { method: UnmodelledFilterMethod; args: unknown[] }[] = [];

/**
 * Install the row-backed `from`, recording those three filter arguments.
 *
 * They are PostgREST *query strings*, and a filter string's contents are
 * invisible in the rows it selects — which is fine for "did this query find the
 * right person" and useless for "is the string this action builds safe to send
 * to PostgREST at all". A few tests below exist only for the second question:
 * sanitizing `)` and `,` out of a search term, escaping a literal `%`, refusing
 * to send an empty needle. So the builder's arguments are recorded *alongside*
 * the row-based mock rather than instead of it — the rows still have to be
 * selected for those tests to pass, and the string has to be the right string.
 *
 * The recorder lives in `supabase-mock.ts` rather than here, because a second
 * suite needing it is exactly how two copies drift.
 */
function installRowBackedClient(): void {
  const base = createMockAdminClient(tables, { recordFilters: true });
  filterCalls = base.filterCalls;
  mockAdminClient.from.mockImplementation(base.from);
}

/** Records which table each `.from()` call was for, in order. */
function tableCalls(): string[] {
  return mockAdminClient.from.mock.calls.map((c) => c[0] as string);
}

describe('CRM reads and bookkeeping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `clearAllMocks` clears call history but keeps implementations, including
    // any unconsumed `mockReturnValueOnce` queue — so a test that set up a
    // two-step chain and consumed one step leaks its last builder into the next
    // test, which then reads rows it never described. `mockReset` drops the
    // whole implementation, and nothing is queued here at all: every test gets
    // a fresh row set and a `from` built over it.
    mockAdminClient.from.mockReset();
    mockAdminClient.rpc.mockReset();
    tables = {};
    filterCalls = [];
    installRowBackedClient();

    mockEnv.CRM_BROADCAST_FUNCTION_URL = undefined;
    mockEnv.SUPABASE_SECRET_KEY = undefined;
    mockEnv.ADMIN_ORDER_EMAIL = 'contact@indivisiblefairoaks.org';
  });

  describe('getCRMBroadcasts', () => {
    /**
     * Drafts are excluded in the query, not filtered afterwards, because
     * `crm_broadcasts_recent_idx` is a partial index on `status <> 'draft'` and
     * a query that does not state the predicate cannot use it — so this read was
     * doing a full scan of every row the chapter ever composed. And a draft in
     * "Past Campaigns" claims people were contacted when nobody was.
     *
     * The predicate living in SQL rather than in JS is a query-shape property
     * the row-based mock cannot observe — it has no planner and no index. What
     * it can observe is the outcome that property exists to produce, which is
     * the draft's absence: a draft with the *newest* `created_at` is seeded so
     * that dropping the exclusion puts it at the front of the list and the
     * assertion below fails.
     */
    it('asks the database to exclude drafts, so the partial index applies', async () => {
      tables.crm_broadcasts = {
        rows: [
          {
            id: 'draft-1',
            subject: 'Still writing this one',
            status: 'draft',
            created_at: '2026-09-30T00:00:00.000Z',
          },
          { id: 'b1', subject: 'Rally', status: 'sent', created_at: '2026-09-01T00:00:00.000Z' },
        ],
      };

      const history = await getCRMBroadcasts();

      expect(history.map((b) => b.id)).toEqual(['b1']);
      expect(tableCalls()).toEqual(['crm_broadcasts']);
    });

    it('returns what the query gave it', async () => {
      // Newest first, and the seed is written in that order so the assertion
      // pins the sort rather than the declaration: the stub this replaced could
      // not tell `ascending: false` from `ascending: true`.
      const rows = [
        { id: 'b1', subject: 'Rally', status: 'sent', created_at: '2026-09-10T00:00:00.000Z' },
        {
          id: 'b2',
          subject: 'Test',
          status: 'sent',
          test_only: true,
          created_at: '2026-09-01T00:00:00.000Z',
        },
      ];
      tables.crm_broadcasts = { rows };

      await expect(getCRMBroadcasts()).resolves.toEqual(rows);
    });

    it('throws with the database message rather than returning an empty history', async () => {
      // A silent empty list reads as "you have never sent anything", which is
      // the one interpretation an organizer must not draw from a failure.
      tables.crm_broadcasts = { rows: [], error: { message: 'connection reset' } };

      await expect(getCRMBroadcasts()).rejects.toThrow('connection reset');
    });
  });

  describe('getCRMBroadcastDrafts', () => {
    it('selects only drafts, newest first, and bounded', async () => {
      // 21 drafts, so the `limit(20)` bound is visible as a truncated list
      // instead of as an argument, plus one sent row that must not appear at
      // all.
      //
      // `created_at` runs the *opposite* way from `updated_at`, on purpose.
      // Drafts are resumed most-recently-touched, not most-recently-created,
      // because `saveCRMBroadcastDraft` is an upsert: a week-old draft edited
      // today is the one the author wants. Ordering on the wrong column returns
      // a different list, so the assertion says which of the two it is.
      const drafts = Array.from({ length: 21 }, (_, i) => ({
        id: `d${String(i).padStart(2, '0')}`,
        status: 'draft',
        created_at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
        updated_at: new Date(Date.UTC(2026, 8, 30 - i)).toISOString(),
      }));
      tables.crm_broadcasts = {
        rows: [
          ...drafts,
          {
            id: 'sent-1',
            status: 'sent',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = await getCRMBroadcastDrafts();

      // The twenty most recently touched drafts, in that order: the sent row is
      // absent and `d20` — the oldest — is the one that falls off the end.
      expect(result.map((d) => d.id)).toEqual(drafts.slice(0, 20).map((d) => d.id));
    });
  });

  describe('getBroadcastProgress', () => {
    it('maps a row onto the progress shape', async () => {
      tables.crm_broadcasts = {
        rows: [
          {
            id: 'b1',
            subject: 'Rally tomorrow',
            status: 'sending',
            recipient_count: 500,
            sent_count: 120,
            failed_count: 2,
            sent_at: null,
            created_at: '2026-09-01T00:00:00.000Z',
          },
        ],
      };

      const progress = await getBroadcastProgress('b1');

      // `subject` is asserted as well as the counters: this read names eight
      // columns explicitly, and a typo in that list reads as `undefined` on the
      // composer's card rather than as a failing query.
      expect(progress).toMatchObject({
        id: 'b1',
        subject: 'Rally tomorrow',
        status: 'sending',
        recipientCount: 500,
        sentCount: 120,
        failedCount: 2,
      });
    });

    it('returns null for a broadcast that no longer exists', async () => {
      // The composer polls by id; a deleted row is a normal end state, not an
      // error to surface as a toast about a campaign that is already gone.
      // Another campaign is in the table on purpose: the row is absent because
      // the query filtered for this id, not because the table was empty.
      tables.crm_broadcasts = { rows: [{ id: 'b1', status: 'sent' }] };

      await expect(getBroadcastProgress('missing')).resolves.toBeNull();
    });

    it('throws when the read itself fails', async () => {
      tables.crm_broadcasts = { rows: [{ id: 'b1' }], error: { message: 'timeout' } };

      await expect(getBroadcastProgress('b1')).rejects.toThrow('Failed to read broadcast progress');
    });
  });

  describe('previewCRMBroadcast', () => {
    beforeEach(() => {
      mockEnv.SUPABASE_URL = 'https://project.supabase.co';
    });

    it('renders through the same builder the sender uses', async () => {
      // A preview built by different code than the sender is the "Sensory
      // Preview" that omitted the logo, greeting, brand shell and unsubscribe
      // footer — an author approving an email no recipient would receive.
      // Nothing is read: this is pure rendering, so the row-based client is
      // never touched and the assertion is entirely on the output.
      const preview = await previewCRMBroadcast({
        subject: 'Rally tomorrow',
        body: 'Meet at the library',
        recipientName: 'Robin',
      });

      expect(preview.html).toContain('Robin');
      expect(preview.html).toContain('Meet at the library');
      // The subject is returned so the composer can show what the inbox will
      // say, and is derived through the same `[TEST`-aware formatter.
      expect(typeof preview.subject).toBe('string');
      expect(preview.text).toContain('Robin');
      expect(mockAdminClient.from).not.toHaveBeenCalled();
    });
  });

  describe('deleteCRMBroadcastDraft', () => {
    it('refuses a row that is not a draft, because it is the audit trail', async () => {
      tables.crm_broadcasts = { rows: [{ id: 'b1', status: 'sent' }] };

      const res = await deleteCRMBroadcastDraft('b1');

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/only unsent drafts/i);
      // The row is still there. The check has to happen before the delete, or a
      // sent campaign's `email_sent` activities are orphaned — and one `.from()`
      // call is what "before" looks like from here.
      expect(tables.crm_broadcasts.rows).toHaveLength(1);
      expect(tableCalls()).toEqual(['crm_broadcasts']);
    });

    it('reports a row that has already gone', async () => {
      // A different draft is present, so the "no longer exists" answer is
      // produced by the id filter rather than by an empty table.
      tables.crm_broadcasts = { rows: [{ id: 'b2', status: 'draft' }] };

      const res = await deleteCRMBroadcastDraft('b1');

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/no longer exists/i);
      expect(tables.crm_broadcasts.rows).toHaveLength(1);
    });

    it('deletes a real draft', async () => {
      // Two drafts, and the one that survives is the one this delete did not
      // name. `expect(qb.delete).toHaveBeenCalled()` could not tell those apart:
      // it is true whether or not the filter matched anything.
      tables.crm_broadcasts = {
        rows: [
          { id: 'b1', status: 'draft' },
          { id: 'b2', status: 'draft' },
        ],
      };

      const res = await deleteCRMBroadcastDraft('b1');

      expect(res).toEqual({ success: true });
      expect(tables.crm_broadcasts.rows?.map((b) => b.id)).toEqual(['b2']);
    });
  });

  describe('segments', () => {
    it('lists the most recent segments', async () => {
      // 51 rows, so the `limit(50)` bound — which the old suite asserted as a
      // call argument and never checked against a result — is visible as a
      // truncated list. Distinct `created_at`s so the ordering cannot be
      // satisfied by declaration order either.
      const seeded = Array.from({ length: 51 }, (_, i) => ({
        id: `s${String(i).padStart(2, '0')}`,
        name: `Segment ${i}`,
        created_at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
      }));
      tables.crm_segments = { rows: seeded };

      const segments = await getCRMSegments();

      expect(tableCalls()).toEqual(['crm_segments']);
      expect(segments).toHaveLength(50);
      expect(segments[0]?.id).toBe('s50');
      // `s00` is the oldest, so it is the row the bound drops.
      expect(segments[49]?.id).toBe('s01');
    });

    it('saves a segment', async () => {
      // `id`, `query`, the three array columns and `created_at` are database
      // defaults (`gen_random_uuid()`, `now()`, `'{}'`), so they are declared
      // here rather than invented by the action.
      tables.crm_segments = {
        rows: [],
        insert: {
          id: 's1',
          query: '',
          statuses: [],
          districts: [],
          tags: [],
          created_at: '2026-09-30T00:00:00.000Z',
        },
      };

      const res = await saveCRMSegment({ name: 'Canvassers', statuses: ['supporter'] });

      expect(res).toEqual({ success: true, segmentId: 's1' });
      // The row that reached the database. A saved segment has to carry the
      // filter it was saved with, or reopening it restores an audience of
      // everyone.
      expect(tables.crm_segments.rows?.[0]).toMatchObject({
        id: 's1',
        name: 'Canvassers',
        statuses: ['supporter'],
      });
    });

    it('turns a duplicate-name violation into a sentence a volunteer can act on', async () => {
      // 23505 is a Postgres error code, not an instruction. The raw text is
      // what a volunteer sees if this mapping is missing.
      tables.crm_segments = { rows: [], error: { code: '23505', message: 'duplicate key' } };

      const res = await saveCRMSegment({ name: 'Canvassers' });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/already/i);
      expect(res.error).not.toMatch(/23505|duplicate key/);
    });

    it('deletes a segment', async () => {
      tables.crm_segments = {
        rows: [
          { id: 's1', name: 'Canvassers' },
          { id: 's2', name: 'Choir' },
        ],
      };

      await expect(deleteCRMSegment('s1')).resolves.toEqual({ success: true });
      expect(tables.crm_segments.rows?.map((s) => s.id)).toEqual(['s2']);
    });

    it('reports a delete that failed', async () => {
      tables.crm_segments = { rows: [{ id: 's1' }], error: { message: 'fk violation' } };

      const res = await deleteCRMSegment('s1');

      expect(res.success).toBe(false);
      expect(res.error).toBe('fk violation');
    });
  });

  describe('getCRMContacts', () => {
    it('clamps a hostile page size instead of asking the database for a million rows', async () => {
      // 150 rows, so the clamp is observable as a slice rather than as two
      // numbers: 100 contacts handed back, 150 in the count. `page: 0` is the
      // other half — unclamped it asks for `range(-100, -1)`, which is a 416
      // rather than a read, and against a row set it comes back empty.
      const seeded = Array.from({ length: 150 }, (_, i) => ({
        id: `c${String(i).padStart(3, '0')}`,
        email: `c${i}@example.org`,
        created_at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
      }));
      tables.crm_contacts = { rows: seeded };

      const res = await getCRMContacts({ page: 0, pageSize: 100000 });

      expect(res.contacts).toHaveLength(100);
      expect(res.totalCount).toBe(150);
      // Newest first, and the first page: a second page would not start at the
      // newest contact.
      expect(res.contacts[0]?.id).toBe('c149');
    });
  });

  describe('tasks', () => {
    it('reads the follow-up board', async () => {
      // `scope: 'open'` is a *row* filter: the board is a page of a table that
      // also holds closed tasks. Seeding both states is what shows the query
      // excludes them, rather than the component filtering after the read.
      tables.crm_tasks = {
        rows: [
          { id: 't1', title: 'Call back', status: 'open', due_at: null, created_at: '2026-09-20' },
          {
            id: 't2',
            title: 'Filed the forms',
            status: 'done',
            due_at: '2026-09-01',
            created_at: '2026-09-19',
          },
          {
            id: 't3',
            title: 'Confirm the venue',
            status: 'open',
            due_at: '2027-05-01',
            created_at: '2026-09-18',
          },
        ],
      };

      const res = await getCRMTasks({ scope: 'open' });

      // Only *how many* rows matched is asserted, and that is a limit of the
      // shared mock rather than a choice: this read selects
      // `'*, contact:crm_contacts(id, first_name, last_name, email)'` — one
      // string holding an embedded resource, which the mock's column projection
      // splits on commas into names that resolve to nothing. (`first_name`
      // happens to survive, as the *task's* own column — not the joined
      // contact's, so it cannot stand in for the embed.) Which rows matched
      // stays fully observable, because filtering happens before the projection;
      // what the projection destroys is the row's contents. Modelling PostgREST's
      // embed syntax is the mock's job, not this file's.
      expect(res.tasks).toHaveLength(2);
      expect(res.totalCount).toBe(2);
    });

    /**
     * Reads throw, mutations return `{ success, error }`. That split is
     * deliberate and worth pinning: reads are called from server components,
     * where a throw reaches the nearest error boundary, while mutations are
     * called from client components, where a returned error becomes a toast. A
     * read that returned `undefined` on failure would render an empty contact
     * page and look like a person who does not exist.
     */
    it('reads one contact’s tasks, and throws rather than returning an error object', async () => {
      const mine = {
        id: 't1',
        title: 'Call back',
        contact_id: 'c1',
        status: 'done',
        due_at: '2026-01-01',
      };
      const upcoming = {
        id: 't2',
        title: 'Confirm the venue',
        contact_id: 'c1',
        status: 'open',
        due_at: '2026-02-01',
      };
      const theirs = {
        id: 't3',
        title: 'Chase the clerk',
        contact_id: 'c2',
        status: 'done',
        due_at: '2026-01-15',
      };
      tables.crm_tasks = {
        rows: [mine, upcoming, theirs],
        // `.or('status.eq.done,and(status.eq.open,due_at.gte.<today>)')` is a
        // PostgREST filter string the mock deliberately does not parse, so the
        // rows it selects are declared: all three, because all three are done
        // or open-and-dated. `t3` is in that set on purpose — it is someone
        // else's task, so the `.eq('contact_id', id)` in front of the `.or()`
        // still has to do its job for the answer to be right.
        filterRows: [mine, upcoming, theirs],
      };

      const res = await getCRMTasksForContact('c1');

      expect(res.map((t) => t.id)).toEqual(['t1', 't2']);
    });

    it('throws on a failed task read instead of returning an empty list', async () => {
      tables.crm_tasks = { rows: [{ id: 't1' }], error: { message: 'boom' } };

      await expect(getCRMTasksForContact('c1')).rejects.toThrow('boom');
    });

    it('creates a chapter-wide task with no contact', async () => {
      // `crm_tasks.contact_id` is nullable so the board can hold a task that is
      // not about one person. The column allowing null is half the contract;
      // the other half is that the action *writes* null rather than leaving the
      // key out, which PostgREST would take as "use the default". `id` is a
      // `gen_random_uuid()` default, so the row's identity comes from the table
      // config and the action has to read it back out of the insert.
      tables.crm_tasks = { rows: [], insert: { id: 't1' } };

      const res = await addCRMTask({ title: 'Print yard signs' });

      expect(res).toEqual({ success: true, taskId: 't1' });
      const row = tables.crm_tasks.rows?.[0];
      expect(row?.contact_id).toBeNull();
      expect(row?.created_by).toBe('admin-user-uuid-1234');
      expect(row?.title).toBe('Print yard signs');
    });

    it('deletes a task and reports a failure', async () => {
      // Two deletes, two database behaviours. The old suite queued two builders
      // with `mockReturnValueOnce`, which `vi.clearAllMocks` does not drain — so
      // the second builder leaked into whatever test ran next. Re-declaring the
      // table between the two calls is the row-based way of saying "and now the
      // database refuses".
      tables.crm_tasks = {
        rows: [
          { id: 't1', contact_id: 'c1' },
          { id: 't2', contact_id: 'c1' },
        ],
      };
      await deleteCRMTask('t1');

      // The row left the table and its neighbour did not: a `.delete()` that
      // was *called* proves nothing about a filter that matched nothing.
      expect(tables.crm_tasks.rows?.map((t) => t.id)).toEqual(['t2']);
      // The return value is deliberately not asserted here. This delete asks
      // for the row back — `.delete().eq('id', id).select('contact_id').single()`
      // — which is a `DELETE … RETURNING`, and the shared mock answers every
      // delete with `data: null` on the grounds that PostgREST has no rows to
      // return. The real database does return the deleted row, so the action
      // sees PGRST116 here and reports `success: false` where it would report
      // `success: true` in production. The row-level outcome above is the part
      // the mock does model, and `crm.test.ts` still covers the success value
      // with a builder that can express it.

      tables.crm_tasks = { rows: [{ id: 't1', contact_id: 'c1' }], error: { message: 'nope' } };
      const res = await deleteCRMTask('t1');
      expect(res).toEqual({ success: false, error: 'nope' });
    });
  });

  describe('getCRMContactDetail', () => {
    it('reads the contact with its timeline and tasks', async () => {
      const contact = { id: 'c1', first_name: 'Robin', email: 'robin@example.org' };
      // `a9` and `t9` belong to somebody else, and both tables' queries
      // `order()` before they return, so an id filter that never ran would put
      // them in the answer.
      tables.crm_contacts = { rows: [contact, { id: 'c2', first_name: 'Sam' }] };
      tables.crm_activities = {
        rows: [
          { id: 'a2', type: 'note', contact_id: 'c1', created_at: '2026-09-01' },
          { id: 'a9', type: 'note', contact_id: 'c2', created_at: '2026-09-05' },
          { id: 'a1', type: 'email_sent', contact_id: 'c1', created_at: '2026-09-02' },
        ],
      };
      tables.crm_tasks = {
        rows: [
          { id: 't1', title: 'Call back', contact_id: 'c1', due_at: '2026-08-01' },
          { id: 't9', title: 'Chase the clerk', contact_id: 'c2', due_at: '2026-07-01' },
        ],
      };

      const res = await getCRMContactDetail('c1');

      expect(res.contact).toEqual(contact);
      // Newest first, and only this contact's.
      expect(res.activities.map((a) => a.id)).toEqual(['a1', 'a2']);
      expect(res.tasks.map((t) => t.id)).toEqual(['t1']);
    });

    it('throws for a contact that does not exist rather than rendering an empty page', async () => {
      // `.single()` against zero rows is PostgREST's PGRST116, which the mock
      // reproduces, and the action turns it into a sentence. Another contact is
      // in the table so the "not found" is the id filter's doing.
      tables.crm_contacts = { rows: [{ id: 'c2', first_name: 'Sam' }] };
      tables.crm_activities = { rows: [] };
      tables.crm_tasks = { rows: [] };

      await expect(getCRMContactDetail('missing')).rejects.toThrow(/not found/i);
    });
  });

  describe('getCRMExistingTags', () => {
    /**
     * Case is NOT normalized here, and that is a known gap rather than an
     * oversight in this test: the CSV importer lowercases tags, but a tag typed
     * into the contact editor is stored as written, so `Choir` and `choir` are
     * two different tags in the database and the filter offers both. Recorded in
     * docs/crm-operations.md; the fix is a one-time `UPDATE … lower(tags)` plus
     * lowercasing at the editor boundary, and it is a data change rather than a
     * code change, so it belongs to the chapter.
     */
    it('unions tags across every page without dropping the ones on later pages', async () => {
      // The directory and the composer both build a filter chip list from this,
      // so a tag that appears on page three but not page one has to survive.
      // A full first page, so the loop keeps going: the point of this test is
      // that a tag on page two is not lost to a premature break. The mock pages
      // for real, so the second page is the thousand-and-first row.
      //
      // Zero-padded ids, because the read orders by `id` as text: `c1000`
      // un-padded sorts between `c100` and `c101`, which would quietly put the
      // page-two tag on page one and make the whole test pass against a loop
      // that only ever reads the first page.
      const seeded = Array.from({ length: 1001 }, (_, i) => ({
        id: `c${String(i).padStart(4, '0')}`,
        tags: i === 0 ? ['canvasser', 'Choir'] : i === 1000 ? ['canvasser', 'donor'] : ['member'],
      }));
      tables.crm_contacts = { rows: seeded };

      const tags = await getCRMExistingTags();

      // `donor` lives only on page two. `Choir` is still upper-case next to
      // `canvasser`, which is the gap the note above is about.
      expect(tags).toEqual(['canvasser', 'Choir', 'donor', 'member']);
    });
  });

  describe('setCRMEmailConsent', () => {
    it('flips the flag, stamps unsubscribed_at, and records why', async () => {
      const activities: Record<string, unknown>[] = [];
      tables.crm_contacts = {
        rows: [
          { id: 'c1', email: 'robin@example.org', do_not_email: false, unsubscribed_at: null },
        ],
      };
      tables.crm_activities = { rows: [], insert: {}, onInsert: (row) => activities.push(row) };

      const res = await setCRMEmailConsent({ contactId: 'c1', doNotEmail: true });

      expect(res.success).toBe(true);
      // The contact row itself, not the arguments a stub was handed: this is the
      // flag the sender reads, on the row it reads it from.
      expect(tables.crm_contacts.rows?.[0]).toMatchObject({ do_not_email: true });
      expect(tables.crm_contacts.rows?.[0]?.unsubscribed_at).toBeTruthy();
      // Consent is the one flag a person relies on for their own privacy, so the
      // change is a dated event on the timeline and not a silent column flip.
      expect(activities).toHaveLength(1);
      expect(activities[0]).toMatchObject({
        contact_id: 'c1',
        type: 'note',
        title: 'Email Consent Revoked',
        created_by: 'admin-user-uuid-1234',
      });
    });

    it('clears the stamp when consent is restored', async () => {
      const activities: Record<string, unknown>[] = [];
      // Seeded opted *out*, so an update that did not run leaves the row
      // saying the wrong thing rather than saying nothing.
      tables.crm_contacts = {
        rows: [{ id: 'c1', do_not_email: true, unsubscribed_at: '2026-01-01T00:00:00.000Z' }],
      };
      tables.crm_activities = { rows: [], insert: {}, onInsert: (row) => activities.push(row) };

      await setCRMEmailConsent({ contactId: 'c1', doNotEmail: false });

      expect(tables.crm_contacts.rows?.[0]).toMatchObject({
        do_not_email: false,
        unsubscribed_at: null,
      });
      expect(activities[0]).toMatchObject({ title: 'Email Consent Restored' });
    });

    it('reports a failure instead of showing an opt-out that did not stick', async () => {
      // Consent is the one flag in this database that a person relies on for
      // their own privacy, so a failed write must not look like a success — and
      // the row must not claim the opt-out either.
      const activities: Record<string, unknown>[] = [];
      tables.crm_contacts = {
        rows: [{ id: 'c1', do_not_email: false, unsubscribed_at: null }],
        error: { message: 'permission denied' },
      };
      tables.crm_activities = { rows: [], insert: {}, onInsert: (row) => activities.push(row) };

      const res = await setCRMEmailConsent({ contactId: 'c1', doNotEmail: true });

      expect(res.success).toBe(false);
      expect(res.error).toBeTruthy();
      expect(tables.crm_contacts.rows?.[0]?.do_not_email).toBe(false);
      // No timeline entry for a decision that was not made.
      expect(activities).toHaveLength(0);
    });
  });

  describe('triggerHistoricalCRMSync', () => {
    it('calls the SECURITY DEFINER function rather than reading tables itself', async () => {
      // The function is revoked from anon/authenticated and granted to
      // service_role only. Reading the tables from the action would both defeat
      // the boundary and reintroduce the idempotency bug it exists to hold.
      // An RPC is not a table, so there is no row set to declare here; what
      // makes the claim testable is that *no table was read at all*.
      mockAdminClient.rpc.mockResolvedValue({ data: { contacts_synced: 12 }, error: null });

      const res = await triggerHistoricalCRMSync();

      expect(res).toEqual({ success: true, syncedCount: 12 });
      expect(mockAdminClient.rpc).toHaveBeenCalledWith('crm_sync_historical_records');
      expect(mockAdminClient.from).not.toHaveBeenCalled();
    });

    it('reports an RPC failure', async () => {
      mockAdminClient.rpc.mockResolvedValue({ data: null, error: { message: 'denied' } });
      const res = await triggerHistoricalCRMSync();
      expect(res.success).toBe(false);
      expect(res.error).toBeTruthy();
    });
  });
});

/**
 * The remaining `?? default` and guard branches, grouped because they are one
 * shape: a column that is NOT NULL in the schema being defended against anyway,
 * because a hand-edited row or a future nullable migration should not render as
 * `undefined` in a component. Each of these is a real branch, and each was
 * uncovered.
 */
describe('CRM defensive defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminClient.from.mockReset();
    mockAdminClient.rpc.mockReset();
    tables = {};
    filterCalls = [];
    installRowBackedClient();
  });

  it('fills in a progress row whose counters and date are missing', async () => {
    // `status` is NOT NULL and `created_at` has a default, so this shape should
    // be impossible. It is defended against anyway, and the defence should be
    // exercised — otherwise a future nullable migration is discovered by a
    // composer rendering "NaN of undefined accepted".
    tables.crm_broadcasts = { rows: [{ id: 'b1', subject: null }] };

    const progress = await getBroadcastProgress('b1');

    expect(progress).toMatchObject({
      status: 'draft',
      recipientCount: 0,
      sentCount: 0,
      failedCount: 0,
      subject: null,
    });
    expect(typeof progress?.createdAt).toBe('string');
  });

  it('returns zero rather than undefined when the recipient count comes back null', async () => {
    // The row-based mock cannot express this input. `head: true` answers
    // `count: filtered.length`, which is a number for every row set including
    // the empty one, so there is no way to hand the action a null count from
    // here and the `count ?? 0` branch is unreachable through it.
    //
    // What is still observable — and what the branch exists to protect — is the
    // return *type*: this number is rendered straight into a heading, and
    // `undefined` there renders "undefined contacts". One opted-out contact
    // against a query that only counts opted-in ones is the row set that has to
    // come back as a number rather than as nothing at all.
    tables.crm_contacts = { rows: [{ id: 'c1', do_not_email: true }] };

    const count = await getBroadcastRecipientCount({});

    expect(count).toBe(0);
    expect(typeof count).toBe('number');
  });

  it('applies every audience filter to the recipient count', async () => {
    const member = {
      id: 'c1',
      do_not_email: false,
      status: 'donor',
      district: 'CA-06',
      tags: ['choir'],
    };
    const wrongTag = {
      id: 'c2',
      do_not_email: false,
      status: 'donor',
      district: 'CA-06',
      tags: ['volunteer'],
    };
    const wrongStatus = {
      id: 'c3',
      do_not_email: false,
      status: 'supporter',
      district: 'CA-06',
      tags: ['choir'],
    };
    const wrongDistrict = {
      id: 'c4',
      do_not_email: false,
      status: 'donor',
      district: 'CA-03',
      tags: ['choir'],
    };
    const optedOut = {
      id: 'c5',
      do_not_email: true,
      status: 'donor',
      district: 'CA-06',
      tags: ['choir'],
    };
    tables.crm_contacts = {
      rows: [member, wrongTag, wrongStatus, wrongDistrict, optedOut],
      // `.contains('tags', ['choir'])` is a PostgREST filter the mock does not
      // parse, so the rows it selects are declared: every choir member in the
      // seed, the opted-out one included. The `.in()` filters and the consent
      // check in front of it are evaluated for real, so each of the other four
      // rows is excluded by the column this test is about — and dropping any
      // one of those filters raises the count above 1.
      filterRows: [member, wrongStatus, wrongDistrict, optedOut],
    };

    const count = await getBroadcastRecipientCount({
      targetStatus: ['donor'],
      targetDistricts: ['CA-06'],
      targetTags: ['choir'],
    });

    expect(count).toBe(1);
  });

  it('counts only opted-in contacts', async () => {
    // The composer's number is what an organizer reads before they commit, so it
    // has to exclude the same people the sender will exclude.
    tables.crm_contacts = {
      rows: [
        { id: 'c1', do_not_email: false },
        { id: 'c2', do_not_email: false },
        { id: 'c3', do_not_email: false },
        { id: 'c4', do_not_email: true },
      ],
    };

    await expect(getBroadcastRecipientCount({})).resolves.toBe(3);
  });

  it('throws when the recipient count itself fails', async () => {
    tables.crm_contacts = { rows: [{ id: 'c1' }], error: { message: 'statement timeout' } };

    await expect(getBroadcastRecipientCount({})).rejects.toThrow(
      /failed to count broadcast recipients/i
    );
  });

  it('searches with the full-text index first', async () => {
    const robin = { id: 'c1', email: 'robin@example.org', created_at: '2026-09-10' };
    const sam = { id: 'c2', email: 'sam@example.org', created_at: '2026-09-01' };
    tables.crm_contacts = {
      rows: [robin, sam],
      // FTS over `search_vector` is a filter the mock does not model, so the
      // row it finds is declared: "robin" matches exactly one constituent.
      filterRows: [robin],
    };

    const res = await getCRMContacts({ query: 'robin' });

    expect(res.contacts).toEqual([robin]);
    // The `ilike` fallback is for when the index misses, not a second query to
    // run every time — FTS tokenization will not match a partial name. It runs
    // as a second `from('crm_contacts')`, so the call count is what says it did
    // not fire; the old suite could only assert a stub method was not called.
    expect(mockAdminClient.from).toHaveBeenCalledTimes(1);
    expect(filterCalls).toContainEqual({
      method: 'textSearch',
      args: ['search_vector', 'robin', { type: 'websearch', config: 'simple' }],
    });
  });

  it('falls back to a sanitized ilike when full text matches nothing', async () => {
    // FTS tokenizes, so "Rob" does not find "Robin". The fallback exists for
    // exactly that, and it is the one path that builds a PostgREST filter out
    // of a typed string — where `)` would end a group and `,` would start a new
    // tuple. A contact named `a)or(...)` could otherwise rewrite the filter.
    // No filter row matches, so the fallback is the query that answers.
    tables.crm_contacts = { rows: [], filterRows: [] };

    await getCRMContacts({ query: 'a)or(tags.not.is.null' });

    const orFilter = filterCalls.find((c) => c.method === 'or')?.args[0] as string;
    expect(orFilter).toBeDefined();
    // No `,` and no `)` survive into the filter, and no `.` grouping either.
    expect(orFilter).not.toMatch(/\)/);
    expect(orFilter).toMatch(/^email\.ilike/);
    // Two queries ran, which is the fallback being reached at all.
    expect(mockAdminClient.from).toHaveBeenCalledTimes(2);
  });

  it('escapes a LIKE wildcard so a literal % is not a wildcard', async () => {
    // Unescaped, "100%" in the search box matches every address starting with
    // 100 — which is how a volunteer searching for one person gets shown the
    // whole list.
    tables.crm_contacts = { rows: [], filterRows: [] };

    await getCRMContacts({ query: '100%_off' });

    const orFilter = filterCalls.find((c) => c.method === 'or')?.args[0] as string;
    expect(orFilter).toContain('\\%');
    expect(orFilter).toContain('\\_');
  });

  it('skips the ilike fallback entirely when the term sanitizes to nothing', async () => {
    // A term made only of structural characters would produce
    // `email.ilike.%%` — a filter matching every row — so the fallback is
    // skipped rather than run with an empty needle.
    tables.crm_contacts = { rows: [], filterRows: [] };

    const res = await getCRMContacts({ query: '  ()(), ' });

    expect(filterCalls.filter((c) => c.method === 'or')).toHaveLength(0);
    expect(res.contacts).toEqual([]);
  });

  /**
   * The interface documents `statusList` / `districtList` / `tagList` as taking
   * precedence over the single-value fields, and `resolveFilters` has a whole
   * precedence branch for it. Only the single-value path was exercised, so the
   * branch existed on the strength of a doc comment.
   */
  it('applies the multi-value filter lists in preference to the single ones', async () => {
    // Each row below is excluded by exactly one of the three list filters, and
    // each of them would be *included* if the matching single-value field were
    // used instead. So the answer says which path ran.
    const hit = { id: 'm1', status: 'donor', district: 'CA-03', tags: ['choir', 'canvasser'] };
    const singleStatus = {
      id: 'm2',
      status: 'supporter',
      district: 'CA-07',
      tags: ['choir', 'canvasser'],
    };
    const singleDistrict = {
      id: 'm3',
      status: 'organizer',
      district: 'CA-06',
      tags: ['choir', 'canvasser'],
    };
    const singleTag = { id: 'm4', status: 'donor', district: 'CA-07', tags: ['volunteer'] };
    tables.crm_contacts = {
      rows: [hit, singleStatus, singleDistrict, singleTag],
      // The rows the tag filter selects: anything carrying either tag. The two
      // rows it leaves out are the ones the tag *lists* have to exclude, and
      // `m4` is what a dropped `.contains()` would add back.
      filterRows: [hit, singleStatus, singleDistrict],
    };

    const res = await getCRMContacts({
      status: 'supporter',
      statusList: ['donor', 'organizer'],
      district: 'CA-06',
      districtList: ['CA-03', 'CA-07'],
      tag: 'volunteer',
      tagList: ['choir', 'canvasser'],
    });

    expect(res.contacts.map((c) => c.id)).toEqual(['m1']);
    expect(res.totalCount).toBe(1);
    // A single `.contains` carrying both tags: the query models "any of", not
    // "all of". Compare with the broadcast audience resolver, which loops and so
    // models "all of" — the two are deliberately different and a tag-list filter
    // that became an intersection would silently return fewer people. The rows
    // above cannot show that, because a second `.contains` would still be
    // declared by `filterRows`; the count of tag-filter calls can.
    expect(filterCalls.filter((c) => c.method === 'contains')).toEqual([
      { method: 'contains', args: ['tags', ['choir', 'canvasser']] },
    ]);
  });

  it('survives a contact with no tags at all', async () => {
    // `tags` is `text[] NOT NULL` but the column has been nullable in practice
    // since the migration that added it, and a null array is what the directory
    // has to render rather than crash on.
    tables.crm_contacts = { rows: [{ id: 'c1', email: 'a@b.co', tags: null }] };

    const res = await getCRMContacts({});

    expect(res.contacts).toHaveLength(1);
    expect(res.contacts[0]?.id).toBe('c1');
  });
});
