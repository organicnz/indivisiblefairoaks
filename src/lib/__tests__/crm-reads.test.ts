// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));
vi.mock('server-only', () => ({}));

const session = vi.hoisted(() => ({
  adminUserId: 'admin-user-uuid-1234',
  adminEmail: 'organizer@indivisiblefairoaks.org',
}));

const mockAdminClient = { from: vi.fn(), rpc: vi.fn() };

// The cached wrapper builds its own service-role client, which a unit test
// cannot. Route it through the real, uncached scan over the shared mock instead,
// so the paging and ceiling logic is still exercised end to end.
vi.mock('@/lib/crm-tag-scan', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/crm-tag-scan')>();
  return {
    ...actual,
    getCachedCRMTags: vi.fn(async () =>
      actual.scanCRMTags(mockAdminClient as unknown as Parameters<typeof actual.scanCRMTags>[0])
    ),
  };
});

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
  getBroadcastEmailEvents,
  getBroadcastProgress,
  getBroadcastRecipientCount,
  getCRMBroadcastDrafts,
  getCRMBroadcastHistoryPage,
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
import { BROADCAST_HISTORY_PAGE_SIZE, TAG_SCAN_LIMIT } from '@/lib/crm-limits';
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

  describe('getCRMBroadcastHistoryPage', () => {
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

      const history = await getCRMBroadcastHistoryPage();

      expect(history.broadcasts.map((b) => b.id)).toEqual(['b1']);
      expect(tableCalls()).toEqual(['crm_broadcasts']);
    });

    it('returns what the query gave it, newest first', async () => {
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

      await expect(getCRMBroadcastHistoryPage()).resolves.toMatchObject({
        broadcasts: rows,
      });
    });

    it('throws with the database message rather than returning an empty history', async () => {
      // A silent empty list reads as "you have never sent anything", which is
      // the one interpretation an organizer must not draw from a failure.
      tables.crm_broadcasts = { rows: [], error: { message: 'connection reset' } };

      await expect(getCRMBroadcastHistoryPage()).rejects.toThrow('connection reset');
    });

    /**
     * The count is the chapter's total, and it has to come from the query.
     *
     * This is what the composer's heading and pager render, and it is the number
     * that distinguishes "you have sent 72 campaigns" from "here are 25 of them".
     * Without it the table is silently truncated: a chapter past the page size
     * cannot see its older campaigns and cannot tell that they exist.
     */
    it('reports the total number of campaigns, not the rows on this page', async () => {
      // More rows than one page holds, so a read that returned `rows.length` rather
      // than the query's count would report 25 and be wrong.
      tables.crm_broadcasts = {
        rows: Array.from({ length: 72 }, (_, i) => ({
          id: `b${String(i).padStart(3, '0')}`,
          subject: `Campaign ${i}`,
          status: 'sent',
          created_at: `2026-09-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
        })),
      };

      const history = await getCRMBroadcastHistoryPage();

      expect(history.broadcasts).toHaveLength(BROADCAST_HISTORY_PAGE_SIZE);
      expect(history.totalCount).toBe(72);
    });

    it('clamps a nonsense page from the URL rather than rendering an empty history', async () => {
      /*
       * `Math.max(1, Math.trunc(NaN))` is `NaN` — both `Math.trunc` and `Math.max`
       * propagate it — so `?page=abc` produced `range(NaN, NaN)` and a history that
       * read as "you have never sent a campaign". That is the most misleading thing
       * this page can show: an organizer told their history had vanished goes
       * looking for the bug in their own account, not in a URL.
       *
       * So the assertion is on the *rows*, not on `page`. `page: 1` alone would
       * pass even while the query returned nothing, which is the bug.
       */
      const row = { id: 'b1', status: 'sent', created_at: '2026-09-01T00:00:00.000Z' };
      tables.crm_broadcasts = { rows: [row] };

      for (const page of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
        const res = await getCRMBroadcastHistoryPage({ page });
        expect(res.page, `page=${page} should clamp to 1`).toBe(1);
        expect(res.broadcasts, `page=${page} should still read the first page`).toHaveLength(1);
      }
    });

    it('falls back to the default page size rather than a NaN range', async () => {
      // Same NaN propagation through `pageSize`. A `range(NaN, NaN)` returns
      // nothing even where the page number is fine, so this is a separate
      // expression with its own failure.
      tables.crm_broadcasts = {
        rows: [{ id: 'b1', status: 'sent', created_at: '2026-09-01T00:00:00.000Z' }],
      };

      const res = await getCRMBroadcastHistoryPage({ pageSize: Number.NaN });
      expect(res.broadcasts).toHaveLength(1);
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
      // One more draft than the page holds, so the bound is exercised. The bound
      // is `BROADCAST_HISTORY_PAGE_SIZE` (25), shared with campaign history so
      // one pager serves both reads — it was 20 here and 50 there, which is how a
      // twenty-first draft became unreachable *and* unremovable.
      const drafts = Array.from({ length: 26 }, (_, i) => ({
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

      // The twenty-five most recently touched drafts, in that order: the sent row
      // is absent and `d25` — the oldest — falls off the end. Asserting the exact
      // bound matters: a `.limit()` that silently grew would hide a
      // twenty-sixth draft the organizer can then never open or delete.
      expect(result.map((d) => d.id)).toEqual(drafts.slice(0, 25).map((d) => d.id));
    });
  });

  describe('getCRMBroadcastHistoryPage', () => {
    /**
     * `.limit(50)` with no offset, no count and no pager meant a chapter past
     * fifty campaigns could not see its fifty-first — and a twenty-first draft
     * was unreachable *and* unremovable, which is the failure mode the
     * draft comment above records for a single row, at the scale of a list.
     *
     * The paged read is what makes both reachable, so these tests are about the
     * two things that make it correct: the offset, and a total that is honest
     * about how many campaigns exist rather than how many are on screen.
     */
    const campaigns = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `b${String(i).padStart(2, '0')}`,
        subject: `Campaign ${i}`,
        status: 'sent',
        created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, 0) - i * 86_400_000).toISOString(),
      }));

    it('returns the requested page, newest first, with drafts excluded', async () => {
      const rows = [
        ...campaigns(30),
        {
          id: 'draft-1',
          subject: 'Unsent',
          status: 'draft',
          // Newest, so dropping the exclusion puts it at the front and the
          // assertion below fails.
          created_at: '2027-01-01T00:00:00.000Z',
        },
      ];
      tables.crm_broadcasts = { rows };

      const page = await getCRMBroadcastHistoryPage({ page: 1, pageSize: 10 });

      expect(page.broadcasts.map((b) => b.id)).toEqual(rows.slice(0, 10).map((b) => b.id));
      // The count excludes drafts too, so `totalPages` derived from it does not
      // promise pages that hold nothing but an empty tail.
      expect(page.totalCount).toBe(30);
      expect(page.page).toBe(1);
    });

    it('pages with an offset, so a later page holds different rows', async () => {
      tables.crm_broadcasts = { rows: campaigns(30) };

      const first = await getCRMBroadcastHistoryPage({ page: 1, pageSize: 10 });
      const third = await getCRMBroadcastHistoryPage({ page: 3, pageSize: 10 });

      expect(first.broadcasts.map((b) => b.id)).not.toEqual(third.broadcasts.map((b) => b.id));
      expect(third.broadcasts).toHaveLength(10);
      expect(third.page).toBe(3);
      // Same total on every page — a count that varied per page would make the
      // pager's "page 3 of N" disagree with itself as you moved through it.
      expect(third.totalCount).toBe(first.totalCount);
    });

    it('clamps a hostile pageSize rather than reading the whole table', async () => {
      // `pageSize` arrives from a URL. Unclamped, `?pageSize=100000` is the whole
      // campaign history on one request — on a shared Fluid CPU budget.
      tables.crm_broadcasts = { rows: campaigns(5) };

      const page = await getCRMBroadcastHistoryPage({ pageSize: 100_000 });

      expect(page.broadcasts.length).toBeLessThanOrEqual(100);
    });

    it('defaults to page 1 and a sane size when called with nothing', async () => {
      tables.crm_broadcasts = { rows: campaigns(3) };

      const page = await getCRMBroadcastHistoryPage();

      expect(page.page).toBe(1);
      expect(page.broadcasts.map((b) => b.id)).toEqual(['b00', 'b01', 'b02']);
    });

    it('reports a failure rather than an empty campaign history', async () => {
      // "You have never sent anything" is the one interpretation an organizer
      // must not draw from a database error.
      tables.crm_broadcasts = { rows: [], error: { message: 'connection reset' } };

      await expect(getCRMBroadcastHistoryPage()).rejects.toThrow('connection reset');
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

  describe('getBroadcastEmailEvents', () => {
    const eventRows = [
      {
        id: 'e1',
        event_type: 'bounced',
        contact_id: 'c1',
        occurred_at: '2026-10-02T12:00:00.000Z',
        provider_id: 'evt_1',
        broadcast_id: 'b1',
      },
      {
        id: 'e2',
        event_type: 'opened',
        contact_id: 'c2',
        occurred_at: '2026-10-02T11:00:00.000Z',
        provider_id: 'evt_2',
        broadcast_id: 'b1',
      },
      {
        id: 'e3',
        event_type: 'complained',
        contact_id: 'c-gone',
        occurred_at: '2026-10-02T10:00:00.000Z',
        provider_id: null,
        broadcast_id: 'b1',
      },
    ];

    it('returns newest-first events with recipient emails resolved in one query', async () => {
      tables.crm_email_events = { rows: eventRows };
      tables.crm_contacts = {
        rows: [
          { id: 'c1', email: 'bounce@example.com' },
          { id: 'c2', email: 'opener@example.com' },
        ],
      };

      const res = await getBroadcastEmailEvents('b1');

      // Newest first, and the seed is written newest-first so the assertion
      // pins the sort rather than the declaration.
      expect(res.events.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
      expect(res.events[0]).toMatchObject({
        eventType: 'bounced',
        contactId: 'c1',
        contactEmail: 'bounce@example.com',
        providerId: 'evt_1',
      });
      // The contact row is gone (merged or deleted) but the event remains: a
      // missing email reads as unknown, never as someone else's.
      expect(res.events[2]).toMatchObject({ contactId: 'c-gone', contactEmail: null });
      expect(res.totalCount).toBe(3);
      expect(res.truncated).toBe(false);
      // Exactly two reads: the events, then one batched contact lookup — never
      // a query per event.
      expect(tableCalls()).toEqual(['crm_email_events', 'crm_contacts']);
    });

    it('scopes to the requested broadcast', async () => {
      tables.crm_email_events = {
        rows: [...eventRows, { ...eventRows[0], id: 'e9', broadcast_id: 'other' }],
      };
      tables.crm_contacts = { rows: [] };

      const res = await getBroadcastEmailEvents('b1');

      expect(res.events.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
      expect(res.totalCount).toBe(3);
    });

    it('skips the contact lookup when there are no events', async () => {
      tables.crm_email_events = { rows: [] };

      const res = await getBroadcastEmailEvents('b1');

      expect(res.events).toEqual([]);
      expect(res.totalCount).toBe(0);
      expect(res.truncated).toBe(false);
      expect(tableCalls()).toEqual(['crm_email_events']);
    });

    it('reports truncation past the event cap', async () => {
      tables.crm_email_events = {
        rows: Array.from({ length: 201 }, (_, i) => ({
          id: `e${i}`,
          event_type: 'opened',
          contact_id: `c${i}`,
          occurred_at: `2026-10-02T${String(i % 24).padStart(2, '0')}:00:00.000Z`,
          provider_id: null,
          broadcast_id: 'b1',
        })),
      };
      tables.crm_contacts = { rows: [] };

      const res = await getBroadcastEmailEvents('b1');

      expect(res.events).toHaveLength(200);
      expect(res.totalCount).toBe(201);
      expect(res.truncated).toBe(true);
    });

    it('throws when the events read itself fails', async () => {
      tables.crm_email_events = { rows: [], error: { message: 'timeout' } };

      await expect(getBroadcastEmailEvents('b1')).rejects.toThrow('Failed to read delivery events');
    });

    it('throws when the contact lookup fails', async () => {
      tables.crm_email_events = { rows: [eventRows[0]] };
      tables.crm_contacts = { rows: [], error: { message: 'timeout' } };

      await expect(getBroadcastEmailEvents('b1')).rejects.toThrow('Failed to read delivery events');
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
    it('lists the most recent segments with a truncation flag', async () => {
      // 501 rows against the 500 cap, so the bound is visible as a truncated
      // list rather than asserted as a call argument. Distinct `created_at`s
      // so the ordering cannot be satisfied by declaration order either.
      const seeded = Array.from({ length: 501 }, (_, i) => ({
        id: `s${String(i).padStart(3, '0')}`,
        name: `Segment ${i}`,
        created_at: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString(),
      }));
      tables.crm_segments = { rows: seeded };

      const { segments, truncated } = await getCRMSegments();

      expect(tableCalls()).toEqual(['crm_segments']);
      expect(segments).toHaveLength(500);
      expect(segments[0]?.id).toBe('s500');
      // `s000` is the oldest, so it is the row the bound drops.
      expect(segments[499]?.id).toBe('s001');
      expect(truncated).toBe(true);
    });

    it('reports no truncation when every segment fits', async () => {
      tables.crm_segments = {
        rows: [{ id: 's1', name: 'Choir', created_at: '2026-09-30T00:00:00.000Z' }],
      };

      const { segments, truncated } = await getCRMSegments();

      expect(segments).toHaveLength(1);
      expect(truncated).toBe(false);
    });

    it('throws when the segments query fails', async () => {
      tables.crm_segments = { rows: [], error: { message: 'relation not found' } };

      await expect(getCRMSegments()).rejects.toThrow(/Failed to load segments/i);
    });

    it('returns a validation error for a segment with no name', async () => {
      const res = await saveCRMSegment({ name: '' });

      expect(res.success).toBe(false);
      expect(res.error).toBeTruthy();
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

    it('returns the database error message when the insert fails for other reasons', async () => {
      tables.crm_segments = { rows: [], error: { code: '42501', message: 'permission denied' } };

      const res = await saveCRMSegment({ name: 'Canvassers' });

      expect(res.success).toBe(false);
      expect(res.error).toBe('permission denied');
    });

    it('updates an existing segment by id', async () => {
      tables.crm_segments = {
        rows: [
          {
            id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
            name: 'Old name',
            created_at: '2026-09-01T00:00:00.000Z',
          },
        ],
      };

      const res = await saveCRMSegment({
        id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
        name: 'New name',
      });

      expect(res.success).toBe(true);
      expect(res.segmentId).toBe('a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d');
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

    it('returns an error when the segment does not exist', async () => {
      tables.crm_segments = {
        rows: [{ id: 's2', name: 'Choir' }],
      };

      const res = await deleteCRMSegment('s1');

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/not found/i);
      expect(tables.crm_segments.rows?.map((s) => s.id)).toEqual(['s2']);
    });

    it('returns an error when the segment was concurrently deleted (PGRST116)', async () => {
      tables.crm_segments = {
        rows: [],
      };

      const res = await saveCRMSegment({
        id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
        name: 'Updated name',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeTruthy();
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

    it('throws when the contacts query fails rather than returning an empty directory', async () => {
      // A read that shows zero contacts and reports no error is a chapter that
      // believes it has no constituents. A failed read must say so.
      tables.crm_contacts = { rows: [], error: { message: 'connection reset' } };

      await expect(getCRMContacts()).rejects.toThrow(/failed to load crm contacts/i);
    });

    it('filters contacts by consent=unasked using IS NULL', async () => {
      // consent='unasked' maps to doNotEmail===null which uses .is('do_not_email', null)
      // rather than .eq() — .eq(col, null) becomes `col=eq.null` in PostgREST which
      // matches nothing. This test confirms only null-consent contacts are returned.
      const neverAsked = { id: 'c1', email: 'a@example.com', do_not_email: null };
      const optedIn = { id: 'c2', email: 'b@example.com', do_not_email: false };
      tables.crm_contacts = { rows: [neverAsked, optedIn] };

      const res = await getCRMContacts({ consent: 'unasked' });

      expect(res.contacts.map((c) => c.id)).toEqual(['c1']);
    });

    it('throws when FTS errors on page 2 — does not fall back to ILIKE', async () => {
      // The fallback only fires on page 1. A FTS error on page 2 has no fallback
      // path and getCRMContacts re-throws the error.
      tables.crm_contacts = {
        rows: [],
        error: { message: 'FTS unavailable' },
      };

      await expect(getCRMContacts({ query: 'rally', page: 2, pageSize: 10 })).rejects.toThrow(
        /failed to load crm contacts/i
      );
      // Only one query was issued: no .from() calls beyond the single FTS attempt.
      expect(mockAdminClient.from).toHaveBeenCalledTimes(1);
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

    it('returns a validation error when addCRMTask receives an empty title', async () => {
      const res = await addCRMTask({ title: '  ' });

      expect(res.success).toBe(false);
      expect(res.error).toBeTruthy();
    });

    it('returns a database error when the task insert fails', async () => {
      tables.crm_tasks = { rows: [], error: { message: 'insert failed' } };

      const res = await addCRMTask({ title: 'Call back' });

      expect(res.success).toBe(false);
      expect(res.error).toBe('insert failed');
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

    describe('getCRMTasks scopes', () => {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

      it("scope: 'overdue' — returns open tasks with a past due_at", async () => {
        tables.crm_tasks = {
          rows: [
            { id: 't-overdue', status: 'open', due_at: yesterday },
            { id: 't-upcoming', status: 'open', due_at: tomorrow },
            { id: 't-done', status: 'done', due_at: yesterday },
            { id: 't-noduedate', status: 'open', due_at: null },
          ],
        };

        const res = await getCRMTasks({ scope: 'overdue' });

        // The select uses a join string (`'*, contact:crm_contacts(...)'`) which
        // the mock's comma-splitter cannot project faithfully — `id` is lost.
        // Asserting count + totalCount is the observable boundary the mock exposes.
        expect(res.tasks).toHaveLength(1);
        expect(res.totalCount).toBe(1);
      });

      it("scope: 'upcoming' — returns open tasks with a future due_at or null", async () => {
        const upcoming = { id: 't-upcoming', status: 'open', due_at: tomorrow };
        const nodue = { id: 't-nodue', status: 'open', due_at: null };
        const overdue = { id: 't-overdue', status: 'open', due_at: yesterday };
        const done = { id: 't-done', status: 'done', due_at: null };

        tables.crm_tasks = {
          rows: [upcoming, nodue, overdue, done],
          // `.or('due_at.gte.${today},due_at.is.null')` is not modelled by the
          // mock; declare which rows it selects. The `.eq('status', 'open')`
          // IS modelled and will remove `done` from the result.
          filterRows: [upcoming, nodue, done],
        };

        const res = await getCRMTasks({ scope: 'upcoming' });

        // `done` is removed by `.eq('status', 'open')`, leaving upcoming + nodue.
        expect(res.tasks).toHaveLength(2);
        expect(res.totalCount).toBe(2);
      });

      it("scope: 'upcoming' — a task with due_at: null IS included", async () => {
        const nodue = { id: 't-nodue', status: 'open', due_at: null };

        tables.crm_tasks = {
          rows: [nodue],
          filterRows: [nodue],
        };

        const res = await getCRMTasks({ scope: 'upcoming' });

        expect(res.tasks).toHaveLength(1);
        expect(res.totalCount).toBe(1);
      });

      it("scope: 'done' — returns only completed tasks", async () => {
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
        tables.crm_tasks = {
          rows: [
            { id: 't-done', status: 'done', due_at: yesterday },
            { id: 't-open', status: 'open', due_at: null },
          ],
        };

        const res = await getCRMTasks({ scope: 'done' });

        expect(res.tasks).toHaveLength(1);
        expect(res.totalCount).toBe(1);
      });

      it("scope: 'all' — returns every task regardless of status", async () => {
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
        tables.crm_tasks = {
          rows: [
            { id: 't-done', status: 'done', due_at: yesterday },
            { id: 't-open', status: 'open', due_at: null },
          ],
        };

        const res = await getCRMTasks({ scope: 'all' });

        expect(res.tasks).toHaveLength(2);
        expect(res.totalCount).toBe(2);
      });

      it('throws when the task query errors', async () => {
        tables.crm_tasks = { rows: [], error: { message: 'connection reset' } };

        await expect(getCRMTasks({ scope: 'open' })).rejects.toThrow(/Failed to load tasks/i);
      });
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
          { id: 't1', title: 'Call back', contact_id: 'c1', due_at: '2026-08-01', status: 'open' },
          { id: 't9', title: 'Chase the clerk', contact_id: 'c2', due_at: '2026-07-01' },
        ],
      };

      const res = await getCRMContactDetail('c1');

      expect(res.contact).toEqual(contact);
      // Newest first, and only this contact's.
      expect(res.activities.map((a) => a.id)).toEqual(['a1', 'a2']);
      expect(res.tasks.map((t) => t.id)).toEqual(['t1']);
      // Nothing capped, so the counts are the list lengths and neither flag fires.
      expect(res.taskCount).toBe(1);
      expect(res.tasksTruncated).toBe(false);
      expect(res.openTaskCount).toBe(1);
    });

    it('reports the true task totals when the list is capped', async () => {
      // 51 open tasks against the 50 cap: the panel renders the capped number
      // as the total unless the counts travel with it. A contact with 80 open
      // follow-ups used to read "Follow-ups (50)".
      const contact = { id: 'c1', first_name: 'Robin', email: 'robin@example.org' };
      tables.crm_contacts = { rows: [contact] };
      tables.crm_activities = { rows: [] };
      tables.crm_tasks = {
        rows: Array.from({ length: 51 }, (_, i) => ({
          id: `t${String(i).padStart(2, '0')}`,
          title: `Task ${i}`,
          contact_id: 'c1',
          status: 'open',
        })),
      };

      const res = await getCRMContactDetail('c1');

      expect(res.tasks).toHaveLength(50);
      expect(res.taskCount).toBe(51);
      expect(res.tasksTruncated).toBe(true);
      expect(res.openTaskCount).toBe(51);
    });

    it('throws on a failed task list rather than rendering an empty panel', async () => {
      tables.crm_contacts = { rows: [{ id: 'c1', first_name: 'Robin' }] };
      tables.crm_activities = { rows: [] };
      tables.crm_tasks = { rows: [], error: { message: 'connection reset' } };

      await expect(getCRMContactDetail('c1')).rejects.toThrow(/failed to load contact tasks/i);
    });

    it('throws when the activities query fails', async () => {
      tables.crm_contacts = { rows: [{ id: 'c1', first_name: 'Robin' }] };
      tables.crm_activities = { rows: [], error: { message: 'activity table offline' } };
      tables.crm_tasks = { rows: [] };

      await expect(getCRMContactDetail('c1')).rejects.toThrow(/failed to load contact activities/i);
    });

    it('throws when the open-task count fails even though the list succeeded', async () => {
      // The open count is a second head-query on the same table, so a
      // table-level error fails the list first and never reaches it. Failing
      // only queries filtered on `status` — which is just the open count —
      // proves the count has its own error path rather than rendering a
      // confident "0 open" over a read that never happened.
      tables.crm_contacts = { rows: [{ id: 'c1', first_name: 'Robin' }] };
      tables.crm_activities = { rows: [] };
      tables.crm_tasks = {
        rows: [{ id: 't1', title: 'Call back', contact_id: 'c1', status: 'open' }],
        errors: [{ kind: 'eq', column: 'status', error: { message: 'index unavailable' } }],
      };

      await expect(getCRMContactDetail('c1')).rejects.toThrow(
        /failed to count open contact tasks/i
      );
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

      const { tags, truncated, scanned } = await getCRMExistingTags();

      // `donor` lives only on page two. `Choir` is still upper-case next to
      // `canvasser`, which is the gap the note above is about.
      expect(tags).toEqual(['canvasser', 'Choir', 'donor', 'member']);
      // 1001 rows read, which is past the first page and short of the ceiling —
      // so this read was complete and must not claim otherwise.
      expect(truncated).toBe(false);
      expect(scanned).toBe(1001);
    });

    /**
     * The ceiling is the one case where a partial tag list is a silent hole.
     *
     * A tag held only by an unscanned row gets no chip in the filter bar and none
     * in the composer, so the constituents carrying it cannot be targeted from
     * either surface — and the chapter concludes from an absent chip that nobody
     * has that tag. Returning `truncated` is what makes that state visible; both
     * call sites render it.
     *
     * `TAG_SCAN_LIMIT + 1` rows: one past the ceiling, so the loop reads exactly
     * `TAG_SCAN_LIMIT` and stops. The seed is slow to build, so it is built once
     * per file rather than per test — 20,001 objects is not something to allocate
     * inside a test body on every run.
     */
    it('reports a partial scan when it stops at the row ceiling', async () => {
      const seeded = Array.from({ length: TAG_SCAN_LIMIT + 1 }, (_, i) => ({
        id: `c${String(i).padStart(6, '0')}`,
        tags: ['member'],
      }));
      // The distinguishing tag sits on the very last row — past the ceiling.
      seeded[seeded.length - 1].tags = ['canvasser'];
      tables.crm_contacts = { rows: seeded };

      const { tags, truncated, scanned } = await getCRMExistingTags();

      expect(truncated).toBe(true);
      expect(scanned).toBe(TAG_SCAN_LIMIT);
      // `canvasser` is the point: it exists in the database and is not in the list,
      // which is precisely what `truncated` exists to warn about.
      expect(tags).toEqual(['member']);
      expect(tags).not.toContain('canvasser');
    });

    it('throws when the tag query fails', async () => {
      tables.crm_contacts = {
        error: { message: 'db connection failed' },
      };
      await expect(getCRMExistingTags()).rejects.toThrow(
        'Failed to load tags: db connection failed'
      );
    });

    it('authorizes on every call, before the cached read', async () => {
      // The regression: `'use cache'` sat on this exported server action with
      // `requireAdmin()` inside the cached body, so a cache hit returned the tags
      // without checking the caller. The check has to run on every call.
      const { requireAdmin } = await import('@/lib/admin-auth');
      const { getCachedCRMTags } = await import('@/lib/crm-tag-scan');
      tables.crm_contacts = { rows: [] };
      vi.mocked(requireAdmin).mockClear();
      vi.mocked(getCachedCRMTags).mockClear();

      await getCRMExistingTags();
      await getCRMExistingTags();

      expect(requireAdmin).toHaveBeenCalledTimes(2);
      expect(getCachedCRMTags).toHaveBeenCalledTimes(2);
    });

    it('does not read tags when the caller is not an admin', async () => {
      const { requireAdmin } = await import('@/lib/admin-auth');
      const { getCachedCRMTags } = await import('@/lib/crm-tag-scan');
      vi.mocked(getCachedCRMTags).mockClear();
      vi.mocked(requireAdmin).mockRejectedValueOnce(new Error('NEXT_REDIRECT'));

      await expect(getCRMExistingTags()).rejects.toThrow('NEXT_REDIRECT');
      expect(getCachedCRMTags).not.toHaveBeenCalled();
    });

    it('handles an empty table without error', async () => {
      tables.crm_contacts = { rows: [] };
      const { tags, truncated, scanned } = await getCRMExistingTags();
      expect(tags).toEqual([]);
      expect(truncated).toBe(false);
      expect(scanned).toBe(0);
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

      const res = await setCRMEmailConsent({ contactId: 'c1', doNotEmail: 'opted_out' });

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

    /**
     * Restoring consent keeps the unsubscribe timestamp.
     *
     * It used to clear it, which made "re-subscribed" and "never unsubscribed"
     * indistinguishable on the row afterwards — so an organiser auditing a
     * complaint ("I unsubscribed and kept getting mail") had no date to point at.
     * The timestamp is evidence; `do_not_email` is the state.
     */
    it('keeps the unsubscribe stamp when consent is restored', async () => {
      const activities: Record<string, unknown>[] = [];
      // Seeded opted *out*, so an update that did not run leaves the row
      // saying the wrong thing rather than saying nothing.
      tables.crm_contacts = {
        rows: [{ id: 'c1', do_not_email: true, unsubscribed_at: '2026-01-01T00:00:00.000Z' }],
      };
      tables.crm_activities = { rows: [], insert: {}, onInsert: (row) => activities.push(row) };

      await setCRMEmailConsent({ contactId: 'c1', doNotEmail: 'opted_in' });

      expect(tables.crm_contacts.rows?.[0]?.do_not_email).toBe(false);
      expect(tables.crm_contacts.rows?.[0]?.unsubscribed_at).toBe('2026-01-01T00:00:00.000Z');
      expect(activities[0]).toMatchObject({ title: 'Email Consent Restored' });
    });

    /**
     * The third state, and the reason this action is not a toggle.
     *
     * `unasked` writes SQL NULL — "we have never put this to them" — and the
     * timeline entry names it. A two-state control could not express it, and its
     * nearest equivalent (clearing the flag) wrote a *yes* nobody had given, which
     * is how an admin action can put somebody into a broadcast audience.
     */
    it('writes NULL and says so when consent is set to "never asked"', async () => {
      const activities: Record<string, unknown>[] = [];
      // Seeded opted *in*, so a coercion to `false` here would leave the row in
      // the broadcast audience while the panel claimed otherwise.
      tables.crm_contacts = {
        rows: [{ id: 'c1', do_not_email: false, unsubscribed_at: null }],
      };
      tables.crm_activities = { rows: [], insert: {}, onInsert: (row) => activities.push(row) };

      const res = await setCRMEmailConsent({ contactId: 'c1', doNotEmail: 'unasked' });

      expect(res.success).toBe(true);
      expect(tables.crm_contacts.rows?.[0]?.do_not_email).toBeNull();
      expect(activities[0]).toMatchObject({ title: 'Email Consent Marked Unknown' });
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

      const res = await setCRMEmailConsent({ contactId: 'c1', doNotEmail: 'opted_out' });

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

    expect(count.count).toBe(0);
    expect(typeof count.count).toBe('number');
    expect(count.excludedCount).toBe(1);
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

    expect(count.count).toBe(1);
    expect(count.excludedCount).toBe(1);
  });

  it('counts only opted-in contacts, and reports the opted-out ones it excluded', async () => {
    // The composer's number is what an organizer reads before they commit, so it
    // has to exclude the same people the sender will exclude — and it has to say
    // how many were withheld, or an audience that quietly halved has no
    // explanation on screen.
    tables.crm_contacts = {
      rows: [
        { id: 'c1', do_not_email: false },
        { id: 'c2', do_not_email: false },
        { id: 'c3', do_not_email: false },
        { id: 'c4', do_not_email: true },
      ],
    };

    await expect(getBroadcastRecipientCount({})).resolves.toEqual({ count: 3, excludedCount: 1 });
  });

  it('reports an exclusion count even when every matching contact is opted out', async () => {
    // The zero-audience case is the one that reads worst on screen: the bar has
    // to be able to say "4 people, all excluded" rather than implying nobody
    // opted out, because both states leave a badge reading 0.
    tables.crm_contacts = {
      rows: [
        { id: 'c1', do_not_email: true },
        { id: 'c2', do_not_email: true },
      ],
    };

    await expect(getBroadcastRecipientCount({})).resolves.toEqual({ count: 0, excludedCount: 2 });
  });

  /**
   * The reconciliation, on the exclusion side.
   *
   * `count + excludedCount` is the claim the dispatch bar makes, and it only holds
   * if the exclusion covers every non-audience state. It was `.eq('do_not_email',
   * true)` alone, which was exact while the column was `NOT NULL` and stopped being
   * exact the moment NULL became expressible: every never-asked contact was
   * dropped from the audience while the bar reported them as neither sent nor
   * excluded. The organiser's only clue that people were missing was a number that
   * did not add up.
   */
  it('counts never-asked contacts as excluded, so the two numbers reconcile', async () => {
    tables.crm_contacts = {
      rows: [
        { id: 'c1', do_not_email: false },
        { id: 'c2', do_not_email: true },
        { id: 'c3', do_not_email: null },
      ],
    };

    await expect(getBroadcastRecipientCount({})).resolves.toEqual({ count: 1, excludedCount: 2 });
  });

  /**
   * Every failure path reports, because each one is a number on a screen an
   * organiser is about to trust. A silent zero on either exclusion count reads as
   * "nobody was excluded".
   *
   * `errors` keys on the filter's *operator*, which is the only way to fail one of
   * these two queries without failing the other: both filter `do_not_email`, and
   * they do it differently — `.eq` for the audience, `.not(…, 'is', …)` for the
   * exclusion. Keying on call order would have looked equivalent and broken
   * silently the first time a query was added or reordered.
   */
  it.each([
    ['audience count', 'eq', /failed to count broadcast recipients/i],
    ['exclusion count', 'notIs', /failed to count excluded recipients/i],
  ])('reports a failure in the %s rather than a silent zero', async (_which, kind, message) => {
    tables.crm_contacts = {
      rows: [{ id: 'c1', do_not_email: false }],
      errors: [
        { kind: kind as 'eq' | 'notIs', column: 'do_not_email', error: { message: 'scan failed' } },
      ],
    };

    await expect(getBroadcastRecipientCount({})).rejects.toThrow(message);
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

  it('does not run the ilike fallback for an empty page past the first', async () => {
    // The fallback exists for "the index missed", not for "there is no page
    // 2". It used to fire on *any* empty page: a term whose FTS matches filled
    // exactly one page returned page 1 with `count: 50` and page 2 from ILIKE —
    // a broader predicate — with `count: 500`. The pager then read "page 2 of
    // 10" on a list whose page 1 said "of 1".
    tables.crm_contacts = { rows: [], filterRows: [] };

    const res = await getCRMContacts({ query: 'robin', page: 2 });

    expect(res.contacts).toEqual([]);
    // One query ran: the FTS one. A second `from('crm_contacts')` is the
    // fallback firing, which is what the old condition did here.
    expect(mockAdminClient.from).toHaveBeenCalledTimes(1);
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
