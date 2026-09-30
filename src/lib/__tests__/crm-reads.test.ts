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
 * `vi.fn()` without type arguments types its `mock.calls` as `[][]`, so a direct
 * `calls[0]?.[0]` is a type error. One helper, rather than an `as unknown as`
 * at every assertion site.
 */
function callArg<T>(fn: { mock: { calls: unknown[][] } }, index = 0): T {
  return fn.mock.calls[index]?.[0] as T;
}

function createMockQueryBuilder(terminalResult: Record<string, unknown> = {}) {
  const promise = Promise.resolve(terminalResult);
  const qb = Object.assign(promise, {
    select: vi.fn(() => qb),
    insert: vi.fn(() => qb),
    update: vi.fn(() => qb),
    upsert: vi.fn(() => qb),
    delete: vi.fn(() => qb),
    eq: vi.fn(() => qb),
    neq: vi.fn(() => qb),
    in: vi.fn(() => qb),
    is: vi.fn(() => qb),
    lt: vi.fn(() => qb),
    gt: vi.fn(() => qb),
    gte: vi.fn(() => qb),
    lte: vi.fn(() => qb),
    contains: vi.fn(() => qb),
    or: vi.fn(() => qb),
    textSearch: vi.fn(() => qb),
    order: vi.fn(() => qb),
    limit: vi.fn(() => qb),
    range: vi.fn(() => Promise.resolve(terminalResult)),
    single: vi.fn(() => Promise.resolve(terminalResult)),
    maybeSingle: vi.fn(() => Promise.resolve(terminalResult)),
  });
  return qb;
}

/** Records which table each `.from()` call was for, in order. */
function tableCalls(): string[] {
  return mockAdminClient.from.mock.calls.map((c) => c[0] as string);
}

describe('CRM reads and bookkeeping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
     */
    it('asks the database to exclude drafts, so the partial index applies', async () => {
      const qb = createMockQueryBuilder({ data: [], error: null });
      mockAdminClient.from.mockReturnValue(qb);

      await getCRMBroadcasts();

      const neqArgs = qb.neq.mock.calls[0] as unknown as [string, unknown] | undefined;
      expect(neqArgs?.[0]).toBe('status');
      expect(neqArgs?.[1]).toBe('draft');
      expect(tableCalls()).toEqual(['crm_broadcasts']);
    });

    it('returns what the query gave it', async () => {
      const rows = [
        { id: 'b1', subject: 'Rally', status: 'sent' },
        { id: 'b2', subject: 'Test', status: 'sent', test_only: true },
      ];
      mockAdminClient.from.mockReturnValue(createMockQueryBuilder({ data: rows, error: null }));
      await expect(getCRMBroadcasts()).resolves.toEqual(rows);
    });

    it('throws with the database message rather than returning an empty history', async () => {
      // A silent empty list reads as "you have never sent anything", which is
      // the one interpretation an organizer must not draw from a failure.
      mockAdminClient.from.mockReturnValue(
        createMockQueryBuilder({ data: null, error: { message: 'connection reset' } })
      );
      await expect(getCRMBroadcasts()).rejects.toThrow('connection reset');
    });
  });

  describe('getCRMBroadcastDrafts', () => {
    it('selects only drafts, newest first, and bounded', async () => {
      const qb = createMockQueryBuilder({ data: [], error: null });
      mockAdminClient.from.mockReturnValue(qb);

      await getCRMBroadcastDrafts();

      const eqArgs = qb.eq.mock.calls[0] as unknown as [string, unknown] | undefined;
      expect(eqArgs?.[0]).toBe('status');
      expect(eqArgs?.[1]).toBe('draft');
      // Drafts are resumed most-recently-touched, not most-recently-created:
      // `saveCRMBroadcastDraft` is an upsert, so a week-old draft edited today
      // is the one the author wants.
      const orderArgs = qb.order.mock.calls[0] as unknown as [string, unknown] | undefined;
      expect(orderArgs?.[0]).toBe('updated_at');
      expect(orderArgs?.[1]).toEqual({ ascending: false });
    });
  });

  describe('getBroadcastProgress', () => {
    it('maps a row onto the progress shape', async () => {
      mockAdminClient.from.mockReturnValue(
        createMockQueryBuilder({
          data: {
            id: 'b1',
            subject: 'Rally tomorrow',
            status: 'sending',
            recipient_count: 500,
            sent_count: 120,
            failed_count: 2,
            sent_at: null,
            created_at: '2026-09-01T00:00:00.000Z',
          },
          error: null,
        })
      );

      const progress = await getBroadcastProgress('b1');

      expect(progress).toMatchObject({
        id: 'b1',
        status: 'sending',
        recipientCount: 500,
        sentCount: 120,
        failedCount: 2,
      });
    });

    it('returns null for a broadcast that no longer exists', async () => {
      // The composer polls by id; a deleted row is a normal end state, not an
      // error to surface as a toast about a campaign that is already gone.
      mockAdminClient.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));
      await expect(getBroadcastProgress('missing')).resolves.toBeNull();
    });

    it('throws when the read itself fails', async () => {
      mockAdminClient.from.mockReturnValue(
        createMockQueryBuilder({ data: null, error: { message: 'timeout' } })
      );
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
    });
  });

  describe('deleteCRMBroadcastDraft', () => {
    it('refuses a row that is not a draft, because it is the audit trail', async () => {
      mockAdminClient.from.mockReturnValue(
        createMockQueryBuilder({ data: { status: 'sent' }, error: null })
      );

      const res = await deleteCRMBroadcastDraft('b1');

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/only unsent drafts/i);
      // The check has to happen before the delete, or a sent campaign's
      // `email_sent` activities are orphaned.
      const tables = tableCalls();
      expect(tables.filter((t) => t === 'crm_broadcasts')).toHaveLength(1);
    });

    it('reports a row that has already gone', async () => {
      mockAdminClient.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));
      const res = await deleteCRMBroadcastDraft('b1');
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/no longer exists/i);
    });

    it('deletes a real draft', async () => {
      const qb = createMockQueryBuilder({ data: { status: 'draft' }, error: null });
      mockAdminClient.from.mockReturnValue(qb);

      const res = await deleteCRMBroadcastDraft('b1');

      expect(res).toEqual({ success: true });
      expect(qb.delete).toHaveBeenCalled();
    });
  });

  describe('segments', () => {
    it('lists the most recent segments', async () => {
      const qb = createMockQueryBuilder({ data: [{ id: 's1', name: 'Canvassers' }], error: null });
      mockAdminClient.from.mockReturnValue(qb);

      await getCRMSegments();

      expect(tableCalls()).toEqual(['crm_segments']);
      expect(qb.limit).toHaveBeenCalledWith(50);
    });

    it('saves a segment', async () => {
      const qb = createMockQueryBuilder({ data: { id: 's1' }, error: null });
      mockAdminClient.from.mockReturnValue(qb);

      const res = await saveCRMSegment({ name: 'Canvassers', statuses: ['supporter'] });

      expect(res.success).toBe(true);
    });

    it('turns a duplicate-name violation into a sentence a volunteer can act on', async () => {
      // 23505 is a Postgres error code, not an instruction. The raw text is
      // what a volunteer sees if this mapping is missing.
      mockAdminClient.from.mockReturnValue(
        createMockQueryBuilder({ data: null, error: { code: '23505', message: 'duplicate key' } })
      );

      const res = await saveCRMSegment({ name: 'Canvassers' });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/already/i);
      expect(res.error).not.toMatch(/23505|duplicate key/);
    });

    it('deletes a segment', async () => {
      const qb = createMockQueryBuilder({ data: null, error: null });
      mockAdminClient.from.mockReturnValue(qb);
      await expect(deleteCRMSegment('s1')).resolves.toEqual({ success: true });
    });

    it('reports a delete that failed', async () => {
      mockAdminClient.from.mockReturnValue(
        createMockQueryBuilder({ data: null, error: { message: 'fk violation' } })
      );
      const res = await deleteCRMSegment('s1');
      expect(res.success).toBe(false);
      expect(res.error).toBe('fk violation');
    });
  });

  describe('getCRMContacts', () => {
    it('clamps a hostile page size instead of asking the database for a million rows', async () => {
      const qb = createMockQueryBuilder({ data: [], count: 0, error: null });
      mockAdminClient.from.mockReturnValue(qb);

      await getCRMContacts({ page: 0, pageSize: 100000 });

      const rangeArgs = qb.range.mock.calls[0] as unknown as [number, number] | undefined;
      expect(rangeArgs?.[0]).toBeGreaterThanOrEqual(0);
      expect(rangeArgs?.[1]).toBeLessThanOrEqual(10000);
    });
  });

  describe('tasks', () => {
    it('reads the follow-up board', async () => {
      const qb = createMockQueryBuilder({ data: [], error: null });
      mockAdminClient.from.mockReturnValue(qb);

      await getCRMTasks({ scope: 'open' });

      expect(tableCalls()).toContain('crm_tasks');
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
      const rows = [{ id: 't1', title: 'Call back', contact_id: 'c1' }];
      const qb = createMockQueryBuilder({ data: rows, error: null });
      mockAdminClient.from.mockReturnValue(qb);

      await expect(getCRMTasksForContact('c1')).resolves.toEqual(rows);
      const eqArgs = qb.eq.mock.calls[0] as unknown as [string, unknown] | undefined;
      expect(eqArgs?.[0]).toBe('contact_id');
      expect(eqArgs?.[1]).toBe('c1');
    });

    it('throws on a failed task read instead of returning an empty list', async () => {
      mockAdminClient.from.mockReturnValue(
        createMockQueryBuilder({ data: null, error: { message: 'boom' } })
      );
      await expect(getCRMTasksForContact('c1')).rejects.toThrow('boom');
    });

    it('creates a chapter-wide task with no contact', async () => {
      // `crm_tasks.contact_id` is nullable so the board can hold a task that is
      // not about one person. The board labels it; the column allows it.
      const qb = createMockQueryBuilder({ data: { id: 't1' }, error: null });
      mockAdminClient.from.mockReturnValue(qb);

      const res = await addCRMTask({ title: 'Print yard signs' });

      expect(res.success).toBe(true);
      const insert = callArg<Record<string, unknown>>(qb.insert);
      expect(insert.contact_id).toBeNull();
      expect(insert.created_by).toBe('admin-user-uuid-1234');
    });

    it('deletes a task and reports a failure', async () => {
      const ok = createMockQueryBuilder({ data: null, error: null });
      mockAdminClient.from.mockReturnValueOnce(ok);
      await expect(deleteCRMTask('t1')).resolves.toEqual({ success: true });

      const bad = createMockQueryBuilder({ data: null, error: { message: 'nope' } });
      mockAdminClient.from.mockReturnValueOnce(bad);
      const res = await deleteCRMTask('t1');
      expect(res.success).toBe(false);
      expect(res.error).toBe('nope');
    });
  });

  describe('getCRMContactDetail', () => {
    it('reads the contact with its timeline and tasks', async () => {
      const contact = { id: 'c1', first_name: 'Robin', email: 'robin@example.org' };
      const activities = [{ id: 'a1', type: 'note' }];
      const tasks = [{ id: 't1', title: 'Call back' }];

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'crm_activities') return createMockQueryBuilder({ data: activities });
        if (table === 'crm_tasks') return createMockQueryBuilder({ data: tasks });
        return createMockQueryBuilder({ data: contact });
      });

      const res = await getCRMContactDetail('c1');

      expect(res.contact).toEqual(contact);
      expect(res.activities).toEqual(activities);
      expect(res.tasks).toEqual(tasks);
    });

    it('throws for a contact that does not exist rather than rendering an empty page', async () => {
      mockAdminClient.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));
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
      // A full page, so the loop keeps going: the point of this test is that a
      // tag on page two is not lost to a premature break.
      const fullPage = Array.from({ length: 1000 }, (_, i) => ({
        tags: i === 0 ? ['canvasser', 'Choir'] : ['member'],
      }));
      const pages = [
        { data: fullPage, error: null },
        { data: [{ tags: ['canvasser', 'donor'] }], error: null },
        { data: [], error: null },
      ];
      let call = 0;
      const qb = createMockQueryBuilder();
      qb.range = vi.fn(() => {
        const next = pages[call] ?? { data: [], error: null };
        call += 1;
        return Promise.resolve(next);
      });
      mockAdminClient.from.mockReturnValue(qb);

      const tags = await getCRMExistingTags();

      expect(tags).toContain('canvasser');
      expect(tags).toContain('Choir');
      expect(tags).toContain('donor');
    });
  });

  describe('setCRMEmailConsent', () => {
    it('flips the flag, stamps unsubscribed_at, and records why', async () => {
      const qb = createMockQueryBuilder({ data: null, error: null });
      mockAdminClient.from.mockReturnValue(qb);

      const res = await setCRMEmailConsent({ contactId: 'c1', doNotEmail: true });

      expect(res.success).toBe(true);
      const update = callArg<Record<string, unknown>>(qb.update);
      expect(update.do_not_email).toBe(true);
      expect(update.unsubscribed_at).toBeTruthy();
      // Consent is the one flag a person relies on for their own privacy, so the
      // change is a dated event on the timeline and not a silent column flip.
      expect(qb.insert).toHaveBeenCalled();
    });

    it('clears the stamp when consent is restored', async () => {
      const qb = createMockQueryBuilder({ data: null, error: null });
      mockAdminClient.from.mockReturnValue(qb);

      await setCRMEmailConsent({ contactId: 'c1', doNotEmail: false });

      const update = callArg<Record<string, unknown>>(qb.update);
      expect(update.do_not_email).toBe(false);
      expect(update.unsubscribed_at).toBeNull();
    });

    it('reports a failure instead of showing an opt-out that did not stick', async () => {
      // Consent is the one flag in this database that a person relies on for
      // their own privacy, so a failed write must not look like a success.
      mockAdminClient.from.mockReturnValue(
        createMockQueryBuilder({ data: null, error: { message: 'permission denied' } })
      );
      const res = await setCRMEmailConsent({ contactId: 'c1', doNotEmail: true });
      expect(res.success).toBe(false);
      expect(res.error).toBeTruthy();
    });
  });

  describe('triggerHistoricalCRMSync', () => {
    it('calls the SECURITY DEFINER function rather than reading tables itself', async () => {
      // The function is revoked from anon/authenticated and granted to
      // service_role only. Reading the tables from the action would both defeat
      // the boundary and reintroduce the idempotency bug it exists to hold.
      mockAdminClient.rpc.mockResolvedValue({ data: null, error: null });

      const res = await triggerHistoricalCRMSync();

      expect(res.success).toBe(true);
      expect(mockAdminClient.rpc).toHaveBeenCalledWith('crm_sync_historical_records');
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
  });

  it('fills in a progress row whose counters and date are missing', async () => {
    // `status` is NOT NULL and `created_at` has a default, so this shape should
    // be impossible. It is defended against anyway, and the defence should be
    // exercised — otherwise a future nullable migration is discovered by a
    // composer rendering "NaN of undefined accepted".
    mockAdminClient.from.mockReturnValue(
      createMockQueryBuilder({ data: { id: 'b1', subject: null }, error: null })
    );

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
    mockAdminClient.from.mockReturnValue(createMockQueryBuilder({ count: null, error: null }));
    await expect(getBroadcastRecipientCount({})).resolves.toBe(0);
  });

  it('applies every audience filter to the recipient count', async () => {
    const qb = createMockQueryBuilder({ count: 7, error: null });
    mockAdminClient.from.mockReturnValue(qb);

    await getBroadcastRecipientCount({
      targetStatus: ['donor'],
      targetDistricts: ['CA-06'],
      targetTags: ['choir'],
    });

    expect(qb.in).toHaveBeenCalledWith('status', ['donor']);
    expect(qb.in).toHaveBeenCalledWith('district', ['CA-06']);
    expect(qb.contains).toHaveBeenCalledWith('tags', ['choir']);
  });

  it('counts only opted-in contacts', async () => {
    // The composer's number is what an organizer reads before they commit, so it
    // has to exclude the same people the sender will exclude.
    const qb = createMockQueryBuilder({ count: 3, error: null });
    mockAdminClient.from.mockReturnValue(qb);

    await getBroadcastRecipientCount({});

    const eqArgs = qb.eq.mock.calls[0] as unknown as [string, unknown] | undefined;
    expect(eqArgs?.[0]).toBe('do_not_email');
    expect(eqArgs?.[1]).toBe(false);
  });

  it('throws when the recipient count itself fails', async () => {
    mockAdminClient.from.mockReturnValue(
      createMockQueryBuilder({ count: null, error: { message: 'statement timeout' } })
    );
    await expect(getBroadcastRecipientCount({})).rejects.toThrow(
      /failed to count broadcast recipients/i
    );
  });

  it('searches with the full-text index first', async () => {
    const qb = createMockQueryBuilder({ data: [{ id: 'c1' }], count: 1, error: null });
    mockAdminClient.from.mockReturnValue(qb);

    await getCRMContacts({ query: 'robin' });

    expect(qb.textSearch).toHaveBeenCalledWith(
      'search_vector',
      'robin',
      expect.objectContaining({ type: 'websearch' })
    );
    // The `ilike` fallback is for when the index misses, not a second query to
    // run every time — FTS tokenization will not match a partial name.
    expect(qb.or).not.toHaveBeenCalled();
  });

  it('falls back to a sanitized ilike when full text matches nothing', async () => {
    // FTS tokenizes, so "Rob" does not find "Robin". The fallback exists for
    // exactly that, and it is the one path that builds a PostgREST filter out
    // of a typed string — where `)` would end a group and `,` would start a new
    // tuple. A contact named `a)or(...)` could otherwise rewrite the filter.
    const qb = createMockQueryBuilder({ data: [], count: 0, error: null });
    mockAdminClient.from.mockReturnValue(qb);

    await getCRMContacts({ query: 'a)or(tags.not.is.null' });

    const orArg = qb.or.mock.calls[0] as unknown as [string] | undefined;
    expect(orArg?.[0]).toBeDefined();
    // No `,` and no `)` survive into the filter, and no `.` grouping either.
    expect(orArg?.[0]).not.toMatch(/\)/);
    expect(orArg?.[0]).toMatch(/^email\.ilike/);
  });

  it('escapes a LIKE wildcard so a literal % is not a wildcard', async () => {
    // Unescaped, "100%" in the search box matches every address starting with
    // 100 — which is how a volunteer searching for one person gets shown the
    // whole list.
    const qb = createMockQueryBuilder({ data: [], count: 0, error: null });
    mockAdminClient.from.mockReturnValue(qb);

    await getCRMContacts({ query: '100%_off' });

    const orArg = qb.or.mock.calls[0] as unknown as [string] | undefined;
    expect(orArg?.[0]).toContain('\\%');
    expect(orArg?.[0]).toContain('\\_');
  });

  it('skips the ilike fallback entirely when the term sanitizes to nothing', async () => {
    // A term made only of structural characters would produce
    // `email.ilike.%%` — a filter matching every row — so the fallback is
    // skipped rather than run with an empty needle.
    const qb = createMockQueryBuilder({ data: [], count: 0, error: null });
    mockAdminClient.from.mockReturnValue(qb);

    await getCRMContacts({ query: '  ()(), ' });

    expect(qb.or).not.toHaveBeenCalled();
  });

  /**
   * The interface documents `statusList` / `districtList` / `tagList` as taking
   * precedence over the single-value fields, and `resolveFilters` has a whole
   * precedence branch for it. Only the single-value path was exercised, so the
   * branch existed on the strength of a doc comment.
   */
  it('applies the multi-value filter lists in preference to the single ones', async () => {
    const qb = createMockQueryBuilder({ data: [], count: 0, error: null });
    mockAdminClient.from.mockReturnValue(qb);

    await getCRMContacts({
      status: 'supporter',
      statusList: ['donor', 'organizer'],
      district: 'CA-06',
      districtList: ['CA-03', 'CA-07'],
      tag: 'volunteer',
      tagList: ['choir', 'canvasser'],
    });

    expect(qb.in).toHaveBeenCalledWith('status', ['donor', 'organizer']);
    expect(qb.in).toHaveBeenCalledWith('district', ['CA-03', 'CA-07']);
    // A single `.contains` carrying both tags: the query models "any of", not
    // "all of". Compare with the broadcast audience resolver, which loops and so
    // models "all of" — the two are deliberately different and a tag-list filter
    // that became an intersection would silently return fewer people.
    const contains = qb.contains.mock.calls.map((c) => (c as unknown as [string, unknown])[1]);
    expect(contains).toEqual([['choir', 'canvasser']]);
    // And never the single-value fallback.
    expect(qb.eq).not.toHaveBeenCalledWith('status', 'supporter');
    expect(qb.eq).not.toHaveBeenCalledWith('district', 'CA-06');
  });

  it('survives a contact with no tags at all', async () => {
    const qb = createMockQueryBuilder({
      data: [{ id: 'c1', email: 'a@b.co', tags: null }],
      count: 1,
      error: null,
    });
    mockAdminClient.from.mockReturnValue(qb);

    const res = await getCRMContacts({});

    expect(res.contacts).toHaveLength(1);
  });
});
