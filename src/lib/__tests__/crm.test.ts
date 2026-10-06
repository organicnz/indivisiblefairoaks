import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

// Mock requireAdmin
const mockAdminClient = {
  from: vi.fn(),
  rpc: vi.fn(),
};

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
  addCRMTask,
  deleteCRMTask,
  exportCRMContacts,
  getBroadcastRecipientCount,
  getCRMContacts,
  getCRMStats,
  getCRMTasks,
  importCRMContacts,
  mergeCRMContacts,
  saveCRMBroadcastDraft,
  saveCRMContact,
  saveCRMSegment,
  sendCRMBroadcast,
  sendCRMBroadcastSelfTest,
  sendCRMDirectEmail,
  setCRMEmailConsent,
  setCRMTaskStatus,
} from '@/lib/actions/crm';

import { CRM_EXPORT_LIMIT } from '@/lib/crm-limits';
import { env } from '@/lib/env';
import { createMockAdminClient, type MockTableConfig } from './supabase-mock';

/**
 * Per-test budget for this suite, in the spirit of `PROPERTY_TIMEOUT_MS` in
 * `blocks.test.ts` and `SUITE_TIMEOUT_MS` in `ContentEditor.undo.test.tsx`:
 * the budget is *stated* rather than the global timeout raised, because
 * raising `testTimeout` globally would hide the same cost in every suite that
 * does not have it.
 *
 * The `Broadcast blast radius > refuses an audience larger than the ceiling`
 * test pages 6,000 rows through six full `.range()` pages to prove the
 * resolver stops on permission rather than on a short page. It is ~40 ms on a
 * workstation and exceeded Vitest's 5000 ms default on the self-hosted runner
 * (`37249958031`, 2026-10-05), failing with `Test timed out in 5000ms` while
 * the suite around it ran 118 s with jsdom setup at 47% of tracked time. No
 * assertion failed; the ceiling-refusal behaviour under test is correct.
 *
 * It is a file-level `testTimeout` rather than a third argument on `describe`
 * or per-`it`, for the same reason as the undo suite: that leaves the
 * next-slowest sibling to fail the same way on the next loaded run.
 *
 * 30s is `blocks.test.ts`'s figure, reused rather than invented: the same
 * cause (a real workload on a shared, undersized host) and the same remedy.
 */
vi.setConfig({ testTimeout: 30_000 });

/**
 * Row sets per table, rebuilt for every test.
 *
 * This suite used to hand-roll `createMockQueryBuilder(terminalResult)` and
 * assert on the *arguments* each stub was handed — `expect(qb.insert).toHaveBeenCalledWith(…)`,
 * `expect(qb.eq).toHaveBeenCalledWith('status', 'open')`. Every one of those is
 * satisfied by the stub rather than by the data: a query naming the wrong column
 * records exactly the same calls as a correct one, and a query that matches no
 * rows records the same calls as one that matches all of them. That is the gap
 * `content-media.test.ts` fell into — asserting "keeps a referenced file"
 * against a query that checked nothing at all, green throughout.
 *
 * Describing rows inverts it. The mock evaluates `.eq()`, `.in()`, `.is()` and
 * the rest against real row data, so "the task is done" is `status` having moved
 * on the row the `.eq('id', …)` had to match, and an id the action returns is an
 * id an insert actually produced. What is left asserting on calls rather than
 * rows says so inline, with its reason: the `crm_stats` RPC, which is not a
 * table, the `fetch` assertions, which are about the wire to Resend rather than
 * to the database, and the two "no query was issued at all" checks, where a row
 * set cannot distinguish *when* the action declined.
 */
let tables: Record<string, MockTableConfig>;

describe('Civic CRM Server Actions', () => {
  const originalFetch = global.fetch;
  const mockEnv = env as unknown as Record<string, string | undefined>;
  const originalApiKey = mockEnv.RESEND_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    // `clearAllMocks` clears call history but keeps implementations, so a
    // `from` left over from a previous suite would keep serving *its* tables —
    // which is how a row a test never described still satisfies it. Re-declaring
    // it over a fresh, empty `tables` is what makes each test own its data.
    tables = {};
    mockAdminClient.from.mockImplementation(createMockAdminClient(tables).from);

    mockEnv.RESEND_API_KEY = 're_test_key_dummy';
    mockEnv.RESEND_FROM_EMAIL = 'contact@indivisiblefairoaks.org';
    mockEnv.ADMIN_ORDER_EMAIL = 'contact@indivisiblefairoaks.org';
    mockEnv.CRM_BROADCAST_FUNCTION_URL = undefined;
    mockEnv.SUPABASE_SECRET_KEY = undefined;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mockEnv.RESEND_API_KEY = originalApiKey;
  });

  describe('saveCRMContact', () => {
    it('creates a new contact with normalized email and logs initial activity', async () => {
      // The id is generated by the database, so it is modelled as an insert-time
      // default (`insert`) rather than handed back by a stub. `res.contactId` is
      // then genuinely the id of the row that landed, and the activity below has
      // to name *that* id — two separately stubbed responses satisfied the old
      // suite even if the action had wired one contact's id to another's insert.
      tables.crm_contacts = { rows: [], insert: { id: 'new-contact-123' } };
      tables.crm_activities = { rows: [] };

      const res = await saveCRMContact({
        email: '  ACTIVIST@IndivisibleFairOaks.org  ',
        first_name: 'Jane',
        last_name: 'Organizer',
        district: 'CA-06',
        status: 'active_volunteer',
        tags: ['choir', 'mobilize'],
      });

      expect(res.success).toBe(true);
      expect(res.contactId).toBe('new-contact-123');
      // The row, not the payload a stub was handed.
      expect(tables.crm_contacts.rows?.[0]).toMatchObject({
        email: 'activist@indivisiblefairoaks.org',
        first_name: 'Jane',
        last_name: 'Organizer',
        status: 'active_volunteer',
        source: 'manual',
      });
      expect(tables.crm_activities.rows?.[0]).toMatchObject({
        contact_id: 'new-contact-123',
        type: 'note',
        title: 'Constituent Created',
        created_by: 'admin-user-uuid-1234',
      });
    });

    it('rejects invalid email addresses', async () => {
      const res = await saveCRMContact({
        email: 'not-an-email',
        first_name: 'Test',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('updates an existing contact when valid uuid is provided', async () => {
      const validUuid = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
      // The contact has to exist. The action reads it first — to decide whether
      // the status changed — and refuses the save when that read finds nothing,
      // so a stubbed `{ id }` response let this test run without a contact at
      // all. The supporter status below is what makes the transition recordable.
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
      tables.crm_activities = { rows: [] };

      const res = await saveCRMContact({
        id: validUuid,
        email: 'jane@example.com',
        first_name: 'Jane',
        status: 'organizer',
        tags: ['leadership'],
      });

      expect(res.success).toBe(true);
      expect(res.contactId).toBe(validUuid);
      // Asserted on the row: the write had to match `id`, not land on whichever
      // contact happened to be first in the table.
      expect(tables.crm_contacts.rows?.[0]).toMatchObject({
        first_name: 'Jane',
        status: 'organizer',
        email: 'jane@example.com',
      });
      // The status moved, so the timeline says so and records both ends of it.
      const activity = tables.crm_activities.rows?.[0];
      expect(activity).toMatchObject({ contact_id: validUuid, type: 'status_change' });
      expect(activity?.title).toBe('Status Changed');
      expect(activity?.metadata).toEqual({ from: 'supporter', to: 'organizer' });
    });
  });

  describe('getCRMStats', () => {
    it('reads the aggregate from the crm_stats RPC', async () => {
      // The KPI cards used to select every donor row and sum it in JavaScript,
      // which put an unbounded result set on the wire on every dashboard load.
      // A single aggregate RPC replaces that.
      mockAdminClient.rpc = vi.fn().mockResolvedValue({
        data: {
          total_contacts: 42,
          active_volunteers: 15,
          local_district: 30,
          total_donors: 2,
          total_donations_cents: 15000,
          open_tasks: 7,
        },
        error: null,
      });

      const stats = await getCRMStats();
      // An RPC is not a table, so there is no row set to assert against: the
      // call *is* the observable, and what it returns is checked below.
      expect(mockAdminClient.rpc).toHaveBeenCalledWith('crm_stats');
      expect(stats).toEqual({
        totalContacts: 42,
        activeVolunteers: 15,
        localDistrict: 30,
        totalDonors: 2,
        totalDonationsCents: 15000,
        openTasks: 7,
      });
    });

    it('maps absent keys to zero rather than undefined', async () => {
      mockAdminClient.rpc = vi.fn().mockResolvedValue({ data: {}, error: null });

      const stats = await getCRMStats();
      expect(stats.totalContacts).toBe(0);
      expect(stats.totalDonationsCents).toBe(0);
    });

    it('maps null data to zeros rather than failing', async () => {
      // Unusual path: RPC succeeds but returns null data (no rows). The `?? {}`
      // fallback ensures every key resolves to 0 rather than throwing.
      mockAdminClient.rpc = vi.fn().mockResolvedValue({ data: null, error: null });

      const stats = await getCRMStats();
      expect(stats.totalContacts).toBe(0);
      expect(stats.openTasks).toBe(0);
    });

    it('falls back to per-table counts when the migration has not been applied', async () => {
      // Staged rollout: a database without crm_stats() must still render the
      // dashboard rather than 500 for every admin.
      mockAdminClient.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'function public.crm_stats() does not exist' },
      });
      // The old stub answered `count: 3` to every query on every table, so all
      // three counts were 3 and no filter was ever evaluated. Here the clauses
      // are real: the supporter and the CA-12 volunteer sit in the same table
      // and are what keep the two filtered counts below the total of 5, and the
      // finished task is what keeps the open count at 2 of 3.
      tables.crm_contacts = {
        rows: [
          { id: 'c1', status: 'active_volunteer', district: 'CA-06' },
          { id: 'c2', status: 'choir', district: 'CA-03' },
          { id: 'c3', status: 'organizer', district: 'CA-06' },
          // Neither clause accepts it: a supporter two districts out.
          { id: 'c4', status: 'supporter', district: 'CA-12' },
          // The status clause is what keeps it out of the volunteer count, and
          // the district clause is what puts it in the local count.
          { id: 'c5', status: 'supporter', district: 'CA-06' },
        ],
      };
      tables.crm_tasks = {
        rows: [
          { id: 't1', status: 'open' },
          { id: 't2', status: 'done' },
          { id: 't3', status: 'open' },
        ],
      };

      const stats = await getCRMStats();
      expect(stats.totalContacts).toBe(5);
      expect(stats.activeVolunteers).toBe(3);
      expect(stats.localDistrict).toBe(4);
      expect(stats.openTasks).toBe(2);
      // The legacy path never summed donations, so the card reads zero rather
      // than a made-up total.
      expect(stats.totalDonationsCents).toBe(0);
    });

    it('returns all-zeros when the RPC fails and every fallback query also fails', async () => {
      mockAdminClient.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'function does not exist' },
      });
      tables.crm_contacts = { rows: [], error: { message: 'connection reset' } };
      tables.crm_tasks = { rows: [], error: { message: 'connection reset' } };

      const stats = await getCRMStats();

      expect(stats.totalContacts).toBe(0);
      expect(stats.activeVolunteers).toBe(0);
      expect(stats.localDistrict).toBe(0);
      expect(stats.openTasks).toBe(0);
      expect(stats.totalDonationsCents).toBe(0);
    });
  });

  describe('getCRMContacts', () => {
    it('applies query filters and pagination range', async () => {
      // Eleven volunteers who match every filter, plus one supporter carrying
      // the same `choir` tag. The supporter is the control: `filterRows` states
      // what `.contains('tags', …)` selected — which includes the supporter —
      // so the `.eq('status', …)` clause is what has to remove it.
      const supporter = {
        id: 'supporter-1',
        email: 'supporter@example.com',
        status: 'supporter',
        district: 'CA-06',
        tags: ['choir'],
        // Oldest, so under a descending `created_at` it sits last — which is
        // exactly the slot page 2 would return if it had survived the filter.
        created_at: '2026-01-01T00:00:00Z',
      };
      const volunteers = Array.from({ length: 11 }, (_, i) => ({
        id: `v${i}`,
        email: `vol${i}@example.com`,
        status: 'active_volunteer',
        district: 'CA-06',
        tags: ['choir'],
        created_at: `2026-01-${String(i + 2).padStart(2, '0')}T00:00:00Z`,
      }));
      tables.crm_contacts = {
        rows: [supporter, ...volunteers],
        filterRows: [supporter, ...volunteers],
      };

      const res = await getCRMContacts({
        status: 'active_volunteer',
        district: 'CA-06',
        tag: 'choir',
        query: 'jane',
        page: 2,
        pageSize: 10,
      });

      // Page 2 of a ten-row page is `.range(10, 19)`, so the single row that
      // comes back is the *last* of the eleven — a fact only the range and the
      // ordering can produce, which is why the old suite had to assert the range
      // arguments instead.
      expect(res.contacts).toHaveLength(1);
      expect(res.contacts[0]?.email).toBe('vol0@example.com');
      expect(res.contacts.map((c) => c.email)).not.toContain('supporter@example.com');
      // Counted before the range, so it is the whole filtered set: 11, not the
      // one row on the page.
      expect(res.totalCount).toBe(11);
    });

    it('falls back to ILIKE when FTS returns no rows', async () => {
      const jane = {
        id: '1',
        email: 'jane@example.com',
        first_name: 'Jane',
        last_name: null,
        status: 'supporter',
        district: 'CA-06',
        tags: [],
        notes: null,
        created_at: '2026-01-01T00:00:00Z',
      };
      // Two filter languages against one table: `.textSearch('search_vector', …)`
      // first, and — only because that returned nothing — an
      // `.or(email.ilike.%…%,…)` fallback. `filterRows` is the single knob that
      // says what such a filter selected, so it is a getter answering "nothing"
      // for the full-text pass and the match for the ILIKE pass. Everything the
      // assertions read is still the mock filtering real rows.
      let filterReads = 0;
      tables.crm_contacts = {
        rows: [jane],
        get filterRows() {
          filterReads += 1;
          return filterReads === 1 ? [] : [jane];
        },
      };

      const res = await getCRMContacts({ query: 'jane', pageSize: 10 });

      expect(res.contacts.map((c) => c.email)).toEqual(['jane@example.com']);
      expect(res.totalCount).toBe(1);
      // Both passes really were issued — the fallback is what produced the row,
      // not a first query that happened to match.
      expect(filterReads).toBe(2);
    });

    it('strips PostgREST .or() structural characters from the ILIKE fallback query', async () => {
      // The subject here is the filter *string*: an unescaped `(` or `)` makes
      // PostgREST reject the whole query with a 400, and no row can observe
      // that — `supabase-mock.ts` records them for exactly this case.
      tables.crm_contacts = { rows: [], filterRows: [] };
      const recorder = createMockAdminClient(tables, { recordFilters: true });
      mockAdminClient.from.mockImplementation(recorder.from);

      await getCRMContacts({ query: 'foo (bar), baz', pageSize: 10 });

      // Not `filterCalls[0]`: `getCRMContacts` issues a `textSearch` first and only
      // falls back to `.or()`, so the first recorded call is the FTS attempt and
      // reading it here would assert against the column name.
      const orFilter = String(recorder.filterCalls.find((c) => c.method === 'or')?.args[0] ?? '');
      expect(orFilter).not.toContain('(');
      expect(orFilter).not.toContain(')');
      // Commas only appear as .or() separators between column filters.
      expect(orFilter.split(',').length).toBeGreaterThanOrEqual(5);
      expect(orFilter).toContain('foo bar baz');
    });

    it('pages the directory by a total order — created_at, then id', async () => {
      // created_at ties across a bulk insert, and offsets are only coherent against a
      // total order. A row assertion cannot see this — the page boundary is a
      // property of the query rather than of any row — so this asks the recorder
      // what it was told to order by.
      tables.crm_contacts = { rows: [], filterRows: [] };
      const recorder = createMockAdminClient(tables, { recordFilters: true });
      mockAdminClient.from.mockImplementation(recorder.from);

      await getCRMContacts({ pageSize: 10 });

      expect(recorder.orderCalls).toContainEqual({ column: 'id', ascending: false });
      // Last, not merely present: `.order()` clauses apply in declaration order, so
      // an `id` tiebreak written *before* `created_at` is silently overridden by the
      // very column that ties — present in the call list, absent in effect.
      // `toContainEqual` alone would pass that broken query.
      expect(recorder.orderCalls.at(-1)).toEqual({ column: 'id', ascending: false });
    });

    it('filters the directory by consent, so the opted-out list is auditable', async () => {
      // "Who has opted out?" previously had no answer short of paging the whole
      // directory reading 9px badges, or writing SQL.
      const optedOut = {
        id: 'c1',
        email: 'quiet@example.com',
        status: 'supporter',
        do_not_email: true,
        created_at: '2026-01-01T00:00:00Z',
      };
      const optedIn = {
        id: 'c2',
        email: 'loud@example.com',
        status: 'supporter',
        do_not_email: false,
        created_at: '2026-01-02T00:00:00Z',
      };
      tables.crm_contacts = { rows: [optedOut, optedIn] };

      const res = await getCRMContacts({ consent: 'opted_out' });

      expect(res.contacts.map((c) => c.email)).toEqual(['quiet@example.com']);
      expect(res.totalCount).toBe(1);
    });

    it('filters the directory by the contacts that may still be emailed', async () => {
      const optedOut = {
        id: 'c1',
        email: 'quiet@example.com',
        status: 'supporter',
        do_not_email: true,
        created_at: '2026-01-01T00:00:00Z',
      };
      const optedIn = {
        id: 'c2',
        email: 'loud@example.com',
        status: 'supporter',
        do_not_email: false,
        created_at: '2026-01-02T00:00:00Z',
      };
      tables.crm_contacts = { rows: [optedOut, optedIn] };

      const res = await getCRMContacts({ consent: 'opted_in' });

      expect(res.contacts.map((c) => c.email)).toEqual(['loud@example.com']);
    });
  });

  describe('exportCRMContacts', () => {
    it('returns a CSV covering the full filtered set', async () => {
      // 75 matching rows is more than the 50-row default page, so an export
      // that quietly used the directory's page size would report 50 and fail
      // this assertion — which is what the old `range(0, 9999)` call check was
      // really guarding.
      const supporters = Array.from({ length: 75 }, (_, i) => ({
        id: `c${i}`,
        email: `supporter${i}@example.com`,
        first_name: `Supporter${i}`,
        last_name: null,
        phone: null,
        address: null,
        district: 'CA-06',
        city: null,
        zip_code: null,
        status: 'supporter',
        tags: ['choir'],
        notes: null,
        do_not_email: i === 0,
        total_donated_cents: 1000,
        source: 'import',
        created_at: '2026-01-01T00:00:00Z',
      }));
      // Excluded by the status filter: a file that "covers the full filtered
      // set" must not include rows the filter removed.
      const donor = {
        id: 'd1',
        email: 'donor@example.com',
        first_name: 'Donor',
        last_name: null,
        phone: null,
        address: null,
        district: 'CA-06',
        city: null,
        zip_code: null,
        status: 'donor',
        tags: [],
        notes: null,
        do_not_email: false,
        total_donated_cents: 5000,
        source: 'import',
        created_at: '2026-01-01T00:00:00Z',
      };
      tables.crm_contacts = { rows: [...supporters, donor] };

      const res = await exportCRMContacts({ status: 'supporter' });
      expect(res.error).toBeUndefined();
      expect(res.count).toBe(75);
      expect(res.csv).toContain('Do Not Email');
      expect(res.csv).toContain('supporter0@example.com');
      expect(res.csv).toContain('supporter74@example.com');
      expect(res.csv).toContain('yes');
      expect(res.csv).not.toContain('donor@example.com');
    });

    it('reports truncation instead of returning a silently short file', async () => {
      /*
       * The export is the chapter's only off-platform backup, and it is also the
       * one list that leaves the building. A cap that truncates silently produces
       * a file that looks complete, is re-importable, and is wrong — with nothing
       * in the CSV, the toast, or the file name to say so. The failure surfaces
       * when somebody tries to restore it.
       *
       * So the truncation is *returned*: `truncated` names the cap, and `count` is
       * the number of rows actually in the file rather than the number matched.
       * The toast then reads "10,000 of 12,341" rather than "10,000".
       */
      const many = Array.from({ length: CRM_EXPORT_LIMIT + 5 }, (_, i) => ({
        id: `c${i}`,
        email: `bulk${i}@example.com`,
        first_name: `Bulk${i}`,
        last_name: null,
        phone: null,
        address: null,
        district: null,
        city: null,
        zip_code: null,
        status: 'supporter',
        tags: [],
        notes: null,
        do_not_email: false,
        total_donated_cents: 0,
        source: 'import',
        created_at: '2026-01-01T00:00:00Z',
      }));
      tables.crm_contacts = { rows: many };

      const res = await exportCRMContacts({});

      expect(res.truncated).toBe(true);
      expect(res.count).toBe(CRM_EXPORT_LIMIT);
      // `count` is the rows in the file. Reporting the matched total as `count`
      // next to a `truncated` flag would leave the two contradicting each other.
      expect(res.matchedCount).toBe(CRM_EXPORT_LIMIT + 5);
    });

    it('does not flag truncation for a set that fits', async () => {
      // The flag is load-bearing only if it is absent when nothing was dropped.
      // A `truncated` that is always true trains an organiser to ignore it.
      tables.crm_contacts = {
        rows: [
          {
            id: 'c1',
            email: 'one@example.com',
            first_name: 'One',
            last_name: null,
            phone: null,
            address: null,
            district: null,
            city: null,
            zip_code: null,
            status: 'supporter',
            tags: [],
            notes: null,
            do_not_email: false,
            total_donated_cents: 0,
            source: 'import',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      };

      const res = await exportCRMContacts({});

      expect(res.truncated).toBe(false);
      expect(res.count).toBe(1);
      expect(res.matchedCount).toBe(1);
    });

    it('returns an error object when the database query fails', async () => {
      tables.crm_contacts = { rows: [], error: { message: 'connection timeout' } };

      const res = await exportCRMContacts({});

      expect(res.error).toMatch(/connection timeout/i);
      expect(res.count).toBe(0);
      expect(res.csv).toBe('');
    });

    it('includes the unsubscribed_at column in both header and rows', async () => {
      tables.crm_contacts = {
        rows: [
          {
            id: 'c1',
            email: 'one@example.com',
            first_name: 'One',
            last_name: null,
            phone: null,
            address: null,
            district: null,
            city: null,
            zip_code: null,
            status: 'supporter',
            tags: [],
            notes: null,
            do_not_email: false,
            total_donated_cents: 0,
            source: null,
            created_at: '2026-01-01T00:00:00Z',
            unsubscribed_at: '2026-09-15T00:00:00Z',
          },
        ],
      };

      const res = await exportCRMContacts({});

      expect(res.csv).toContain('Unsubscribed At');
      expect(res.csv).toContain('2026-09-15T00:00:00Z');
    });

    it('handles null first_name, tags, and do_not_email in CSV rows', async () => {
      // Covers the || '' and ?? '' fallback branches on nullable fields.
      // do_not_email === null → empty string (the round-trip safe null representation).
      tables.crm_contacts = {
        rows: [
          {
            id: 'c2',
            email: 'null-fields@example.com',
            first_name: null,
            last_name: null,
            phone: null,
            address: null,
            district: null,
            city: null,
            zip_code: null,
            status: 'supporter',
            tags: null,
            notes: null,
            do_not_email: null,
            total_donated_cents: 0,
            source: null,
            created_at: '2026-01-01T00:00:00Z',
            unsubscribed_at: null,
          },
        ],
      };

      const res = await exportCRMContacts({});

      expect(res.error).toBeUndefined();
      expect(res.count).toBe(1);
      // null do_not_email → empty string, not 'yes' or 'no'
      const row = res.csv.split('\r\n')[1] ?? '';
      // The do_not_email column should be an empty string between commas
      expect(row).not.toContain('yes');
      expect(row).not.toContain('no');
    });
  });

  describe('tasks', () => {
    it('adds an open task for a contact', async () => {
      // The task's id is generated by the database, so it is an insert-time
      // default: `res.taskId` is then the id of the row that landed.
      tables.crm_tasks = { rows: [], insert: { id: 'task-1' } };

      const res = await addCRMTask({
        contactId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
        title: 'Call about canvass',
        dueAt: '2026-10-01',
      });

      expect(res.success).toBe(true);
      expect(res.taskId).toBe('task-1');
      expect(tables.crm_tasks.rows?.[0]).toMatchObject({
        contact_id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
        title: 'Call about canvass',
        due_at: '2026-10-01',
        created_by: 'admin-user-uuid-1234',
      });
    });

    it('rejects an empty task title', async () => {
      const res = await addCRMTask({
        contactId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
        title: '   ',
      });
      expect(res.success).toBe(false);
    });

    it('marks a task done with completed_at', async () => {
      // The update asks for the affected row back (`.select('contact_id')`) so it
      // can revalidate the contact's page, which means an update matching
      // nothing reports an error. `success` being true is therefore already
      // proof that `.eq('id', …)` found a task — where the old stub answered
      // `{error: null}` for a table with no tasks in it at all.
      tables.crm_tasks = {
        rows: [{ id: 'task-1', contact_id: 'c-1', status: 'open', completed_at: null }],
      };

      const res = await setCRMTaskStatus({ id: 'task-1', status: 'done' });
      expect(res.success).toBe(true);
      const task = tables.crm_tasks.rows?.[0];
      expect(task?.status).toBe('done');
      expect(task?.completed_at).toBeTruthy();
    });

    it('reopening a task clears completed_at', async () => {
      // Reopened *from* done, so a stale completion timestamp would survive a
      // payload-only assertion — the board sorts on `due_at` and filters on
      // `status`, and a completed open task is a lie about the follow-up work.
      tables.crm_tasks = {
        rows: [
          {
            id: 'task-1',
            contact_id: 'c-1',
            status: 'done',
            completed_at: '2026-09-01T00:00:00.000Z',
          },
        ],
      };

      const res = await setCRMTaskStatus({ id: 'task-1', status: 'open' });
      expect(res.success).toBe(true);
      expect(tables.crm_tasks.rows?.[0]).toMatchObject({ status: 'open', completed_at: null });
    });

    it('deletes a task by id', async () => {
      // Two tasks, so "the row is gone" and "the table is empty" cannot be
      // confused. The old assertion — that `.delete()` had been called and
      // `.eq()` given the id — is satisfied just as well by a query that matched
      // nothing, which is the outcome an organizer would see as a task that
      // refuses to disappear.
      tables.crm_tasks = {
        rows: [
          { id: 'task-1', contact_id: 'c-1' },
          { id: 'task-2', contact_id: 'c-1' },
        ],
      };
      const res = await deleteCRMTask('task-1');
      expect(res.success).toBe(true);
      expect(tables.crm_tasks.rows?.map((t) => t.id)).toEqual(['task-2']);
    });

    it('lists open tasks scoped with status filter', async () => {
      // `getCRMTasks` selects `*, contact:crm_contacts(id, first_name, …)`, and
      // this mock models no joins, so the assertion is on the count — which the
      // mock computes from the same filtered row set the embedded contact would
      // have been layered over. That is still the status filter under test: the
      // finished task is in the table and does not reach the board.
      tables.crm_tasks = {
        rows: [
          { id: 't-open', status: 'open', due_at: '2026-10-01' },
          { id: 't-done', status: 'done', due_at: '2026-09-01' },
        ],
      };

      const res = await getCRMTasks({ scope: 'open' });
      expect(res.totalCount).toBe(1);
      expect(res.tasks).toHaveLength(1);
    });
  });

  describe('segments', () => {
    it('saves a new named segment', async () => {
      tables.crm_segments = { rows: [], insert: { id: 'seg-1' } };

      const res = await saveCRMSegment({
        name: 'CA-06 choir',
        query: '',
        statuses: ['choir'],
        districts: ['CA-06'],
        tags: [],
      });

      expect(res.success).toBe(true);
      expect(res.segmentId).toBe('seg-1');
      expect(tables.crm_segments.rows?.[0]).toMatchObject({
        name: 'CA-06 choir',
        statuses: ['choir'],
        districts: ['CA-06'],
      });
    });

    it('rejects an empty segment name', async () => {
      const res = await saveCRMSegment({ name: '  ' });
      expect(res.success).toBe(false);
    });

    it('normalises tag case, because the filter chips compare against lowercase', async () => {
      tables.crm_segments = { rows: [], insert: { id: 'seg-2' } };

      const res = await saveCRMSegment({
        name: 'Choir',
        query: '',
        statuses: [],
        districts: [],
        tags: ['Choir', ' CHOIR ', 'Donor'],
      });

      expect(res.success).toBe(true);
      expect(tables.crm_segments.rows?.[0]).toMatchObject({ tags: ['choir', 'donor'] });
    });
  });

  describe('consent', () => {
    it('marks do-not-email and logs an activity', async () => {
      const contactId = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
      // Consent is a property of the row, so it can only be asserted on the
      // row: proving that `.update()` was called with `{do_not_email: true}`
      // says nothing about whether the write reached the contact the caller
      // named — and this flag is the one thing standing between an opt-out and
      // the next broadcast.
      tables.crm_contacts = {
        rows: [{ id: contactId, do_not_email: false, unsubscribed_at: null }],
      };
      tables.crm_activities = { rows: [] };

      const res = await setCRMEmailConsent({ contactId, doNotEmail: 'opted_out' });

      expect(res.success).toBe(true);
      expect(tables.crm_contacts.rows?.[0]).toMatchObject({ do_not_email: true });
      expect(tables.crm_contacts.rows?.[0]?.unsubscribed_at).toBeTruthy();
      expect(tables.crm_activities.rows?.[0]).toMatchObject({
        contact_id: contactId,
        title: 'Email Consent Revoked',
        created_by: 'admin-user-uuid-1234',
      });
    });

    it('blocks direct email when contact is opted out', async () => {
      // The row has to exist: this used to be a stubbed
      // `{ do_not_email: true }` response, which the action could have been
      // reading from any query at all.
      tables.crm_contacts = {
        rows: [
          {
            id: 'c-1',
            email: 'x@example.com',
            first_name: 'X',
            last_name: null,
            do_not_email: true,
            unsubscribe_token: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
          },
        ],
      };
      global.fetch = vi.fn();

      const res = await sendCRMDirectEmail({
        contactId: 'c-1',
        subject: 'Hello',
        message: 'Hi there',
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/unsubscribed/i);
      // Refused before the provider is called, not after.
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('importCRMContacts', () => {
    it('parses CSV, skips existing emails, inserts new rows', async () => {
      const existing = { id: 'e1', email: 'taken@example.com' };
      // The pre-check is a case-insensitive `.or(email.ilike.…)` lookup, one of
      // the three filter languages this mock does not implement, so `filterRows`
      // states which rows it selected. `rows` is the same table the insert then
      // writes into — one config serving both is exactly how a real table does
      // it, and it is what makes the two rows below a real before-and-after.
      tables.crm_contacts = {
        rows: [existing],
        filterRows: [existing],
        insert: { id: 'imported-id' },
      };
      tables.crm_activities = { rows: [] };

      const csv = [
        'email,first_name,last_name,status,tags',
        'taken@example.com,Taken,User,supporter,',
        'brand-new@example.com,New,Person,choir,postcards;canvass',
      ].join('\n');

      const res = await importCRMContacts({ csv });

      expect(res.success).toBe(true);
      expect(res.skipped).toBe(1);
      expect(res.imported).toBe(1);
      // Two rows, not one: the existing contact survived and the new one landed
      // beside it. The old suite asserted the insert payload alone, so an import
      // that replaced rather than appended would have passed.
      expect(tables.crm_contacts.rows?.map((r) => r.email)).toEqual([
        'taken@example.com',
        'brand-new@example.com',
      ]);
      expect(tables.crm_contacts.rows?.[1]).toMatchObject({
        email: 'brand-new@example.com',
        status: 'choir',
        tags: ['postcards', 'canvass'],
        source: 'import',
      });
      // The import activity names the row that was created.
      expect(tables.crm_activities.rows?.[0]).toMatchObject({
        contact_id: 'imported-id',
        type: 'import',
        title: 'Imported from CSV',
        created_by: 'admin-user-uuid-1234',
      });
    });

    it('treats mixed-case DB emails as already imported (case-insensitive pre-check)', async () => {
      // The DB retained mixed case; the CSV parser lowercases its input, so only
      // a case-insensitive lookup catches the duplicate.
      const mixed = { id: 'e1', email: 'Taken@Example.COM' };
      tables.crm_contacts = { rows: [mixed], filterRows: [mixed] };

      const res = await importCRMContacts({
        csv: 'email,first_name\nTaken@Example.COM,Ada',
      });

      expect(res.success).toBe(true);
      expect(res.imported).toBe(0);
      expect(res.skipped).toBe(1);
      // Nothing was written: the table still holds exactly the row it started
      // with. `expect(insert).not.toHaveBeenCalled()` could not tell "skipped"
      // from "inserted a second copy of the same person", which is the failure
      // the UNIQUE index would then reject.
      expect(tables.crm_contacts.rows).toEqual([mixed]);
    });

    it('fails closed when the existing-email lookup errors', async () => {
      tables.crm_contacts = {
        rows: [],
        error: { message: 'permission denied for table crm_contacts' },
      };

      const res = await importCRMContacts({ csv: 'email\na@example.com' });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/lookup failed/i);
    });

    it('rejects empty CSV', async () => {
      const res = await importCRMContacts({ csv: '   ' });
      expect(res.success).toBe(false);
    });

    it('reports error when header lacks email column', async () => {
      const res = await importCRMContacts({ csv: 'name,city\nJane,Fair Oaks' });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/valid rows|email/i);
    });

    it('does not report success when every insert fails', async () => {
      // The pre-check has to *succeed* for the test to reach the insert, and
      // `MockTableConfig.error` is one flag per table — the mock has no notion of
      // "the SELECT succeeded and the INSERT failed", which is exactly the state
      // this action distinguishes when it reports "All inserts failed". The flag
      // is read at terminal time, so a getter expresses it; the rows stay
      // row-based. The old file answered this with two builders picked by a call
      // counter — the same trick as the `mockReturnValueOnce` queues elsewhere in
      // it, and `clearAllMocks` does not drain a `Once` queue.
      let contactsQueries = 0;
      tables.crm_contacts = {
        rows: [],
        get error() {
          contactsQueries += 1;
          return contactsQueries === 1
            ? null
            : { message: 'violates check constraint "crm_contacts_source_check"' };
        },
      };

      const csv = 'email\nnew-person@example.com';
      const res = await importCRMContacts({ csv });

      expect(res.success).toBe(false);
      expect(res.imported).toBe(0);
      expect(res.error).toMatch(/inserts failed/i);
      expect(res.errors?.some((e) => e.message.startsWith('Insert failed'))).toBe(true);
      // And the row never landed, so the directory does not carry a contact the
      // toast says was rejected.
      expect(tables.crm_contacts.rows).toHaveLength(0);
    });
  });

  describe('mergeCRMContacts', () => {
    it('refuses to merge a contact into itself', async () => {
      const res = await mergeCRMContacts({ keepId: 'same-id', removeId: 'same-id' });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/itself/);
      // Declined before touching the table: merging a contact into itself would
      // move everything onto it and then delete the row it just moved onto.
      expect(mockAdminClient.from).not.toHaveBeenCalled();
    });

    /**
     * The merge is one SQL statement now (`merge_crm_contacts`, migration
     * 20261005030000), because four PostgREST statements could not be atomic: a
     * failure after the activities update left the duplicate alive with its
     * timeline and tasks already re-pointed at the survivor, and a concurrent
     * merge of the same pair added `total_donated_cents` twice.
     *
     * Which means the *arithmetic* the merge performs is no longer observable
     * from a mocked client — it is plpgsql inside the database, and no row-based
     * mock can execute it. Asserting it here would be asserting the mock.
     *
     * So this suite asserts the action's half — that both rows are read, that
     * the RPC is called with exactly these arguments including the acting
     * organizer, and that no write statement is issued from the app — and the
     * combination rules live as comments in the migration, where they can be
     * read next to the code that implements them. `merge_crm_contacts` itself is
     * exercised by `scripts/hooks/migration-dryrun.mjs` against a real database.
     */
    it('hands the whole merge to one RPC, with both ids and the acting admin', async () => {
      tables.crm_contacts = {
        rows: [
          {
            id: 'keep-uuid',
            email: 'keep@example.com',
            tags: ['choir'],
            notes: 'keep note',
            total_donated_cents: 500,
            last_contacted_at: '2026-02-01T00:00:00Z',
            do_not_email: false,
            unsubscribed_at: null,
          },
          {
            id: 'remove-uuid',
            email: 'remove@example.com',
            tags: ['donor'],
            notes: 'remove note',
            total_donated_cents: 250,
            last_contacted_at: '2026-03-01T00:00:00Z',
            // The duplicate had opted out. The RPC ORs the flag, so this case is
            // the reason the test rows still exist even though the assertions no
            // longer read them: removing it would quietly stop testing anything.
            do_not_email: true,
            unsubscribed_at: '2026-03-05T00:00:00Z',
          },
        ],
      };
      mockAdminClient.rpc.mockResolvedValue({ error: null });

      const res = await mergeCRMContacts({ keepId: 'keep-uuid', removeId: 'remove-uuid' });

      expect(res.success).toBe(true);
      expect(mockAdminClient.rpc).toHaveBeenCalledWith('merge_crm_contacts', {
        p_keep_id: 'keep-uuid',
        p_remove_id: 'remove-uuid',
        // `p_actor_id` is the admin who authorised the merge, not the function
        // owner: the audit row on the survivor's timeline has to name a person.
        p_actor_id: 'admin-user-uuid-1234',
      });

      // Both rows are read first, so a missing contact is reported as a sentence
      // rather than as the RPC's exception.
      expect(mockAdminClient.from).toHaveBeenCalledTimes(2);

      // And nothing is written outside the statement. This is the assertion that
      // would fail if someone reintroduced the four-statement version: each of
      // those was a separate transaction, and a mid-sequence failure left the
      // duplicate alive with its children already moved.
      expect(mockAdminClient.from).not.toHaveBeenCalledWith('crm_activities');
      expect(mockAdminClient.from).not.toHaveBeenCalledWith('crm_tasks');
    });

    it('refuses when either contact is missing', async () => {
      tables.crm_contacts = { rows: [{ id: 'keep-uuid' }] };

      const res = await mergeCRMContacts({ keepId: 'keep-uuid', removeId: 'gone-uuid' });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/must exist/i);
      expect(mockAdminClient.rpc).not.toHaveBeenCalled();
    });
  });

  describe('addCRMNote', () => {
    it('creates a note activity linked to the contact', async () => {
      tables.crm_activities = { rows: [] };

      const res = await addCRMNote({
        contactId: 'contact-uuid-1',
        title: 'Attended Rally',
        description: 'Brought 4 neighbors and signed up for phonebank.',
      });

      expect(res.success).toBe(true);
      expect(tables.crm_activities.rows?.[0]).toMatchObject({
        contact_id: 'contact-uuid-1',
        type: 'note',
        title: 'Attended Rally',
        description: 'Brought 4 neighbors and signed up for phonebank.',
        created_by: 'admin-user-uuid-1234',
      });
    });

    it('rejects note with empty title', async () => {
      const res = await addCRMNote({
        contactId: 'contact-uuid-1',
        title: '   ',
        description: 'desc',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Title is required');
    });
  });

  describe('sendCRMDirectEmail', () => {
    it('dispatches email through Resend and logs activity', async () => {
      tables.crm_contacts = {
        rows: [
          {
            id: 'c-1',
            email: 'neighbor@example.com',
            first_name: 'Neighbor',
            last_name: 'Person',
            do_not_email: false,
            unsubscribe_token: 'unsub-token-1',
          },
        ],
      };
      tables.crm_activities = { rows: [] };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'resend_msg_123' }),
      });
      global.fetch = mockFetch;

      const res = await sendCRMDirectEmail({
        contactId: 'c-1',
        subject: 'Welcome to the Movement',
        message: 'Thank you for connecting with Indivisible Fair Oaks!',
      });

      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('neighbor@example.com'),
        })
      );
      // The activity carries the provider's message id, so the timeline can be
      // tied back to what Resend actually accepted.
      expect(tables.crm_activities.rows?.[0]).toMatchObject({
        contact_id: 'c-1',
        type: 'email_sent',
        metadata: { resend_id: 'resend_msg_123' },
      });
      // And the contact's last-contacted stamp moved, which is what the
      // directory sorts on and what "who has been reached" is read from. The
      // old suite never looked at the row.
      expect(tables.crm_contacts.rows?.[0]?.last_contacted_at).toBeTruthy();
    });
  });

  describe('getBroadcastRecipientCount & sendCRMBroadcast', () => {
    it('calculates recipient count based on criteria', async () => {
      // `.contains('tags', …)` is one of the three filter languages this mock
      // does not implement, so `filterRows` states which contacts the tag filter
      // selected — all four carry the `choir` tag, and each of the three
      // exclusions is what makes the answer 1 rather than 4. The old stub
      // answered `count: 28` to any query and asserted `.in`/`.contains` as
      // *calls*, so no filter was ever evaluated: a query that named the wrong
      // column would have reported 28 just as happily.
      const rows = [
        {
          id: 'c1',
          email: 'a@example.com',
          do_not_email: false,
          status: 'active_volunteer',
          district: 'CA-06',
          tags: ['choir'],
        },
        {
          id: 'c2',
          email: 'b@example.com',
          do_not_email: true,
          status: 'active_volunteer',
          district: 'CA-06',
          tags: ['choir'],
        },
        {
          id: 'c3',
          email: 'c@example.com',
          do_not_email: false,
          status: 'supporter',
          district: 'CA-06',
          tags: ['choir'],
        },
        {
          id: 'c4',
          email: 'd@example.com',
          do_not_email: false,
          status: 'active_volunteer',
          district: 'CA-12',
          tags: ['choir'],
        },
      ];
      tables.crm_contacts = { rows, filterRows: rows };

      const count = await getBroadcastRecipientCount({
        targetStatus: ['active_volunteer'],
        targetDistricts: ['CA-06'],
        targetTags: ['choir'],
      });

      expect(count.count).toBe(1);
    });

    /**
     * The three states, and the reconciliation the dispatch bar claims.
     *
     * `count + excludedCount` is the number of contacts the audience rules
     * matched. That holds only if the exclusion covers *both* non-audience
     * states, which it did not once NULL became expressible: the query was
     * `.eq('do_not_email', true)` alone, so a never-asked contact was being
     * dropped from the audience while the bar reported them as neither sent nor
     * excluded. The organiser's only signal that people were missing would have
     * been the number being wrong.
     */
    it('excludes never-asked contacts too, so the two counts reconcile', async () => {
      const rows = [
        { id: 'c1', email: 'a@example.com', do_not_email: false, status: 'supporter' },
        { id: 'c2', email: 'b@example.com', do_not_email: true, status: 'supporter' },
        { id: 'c3', email: 'c@example.com', do_not_email: null, status: 'supporter' },
        { id: 'c4', email: 'd@example.com', do_not_email: false, status: 'supporter' },
      ];
      tables.crm_contacts = { rows, filterRows: rows };

      const count = await getBroadcastRecipientCount({});

      // Two agreed, one declined, one never asked.
      expect(count.count).toBe(2);
      expect(count.excludedCount).toBe(2);
      // The claim the dispatch bar makes, asserted rather than assumed.
      expect(count.count + count.excludedCount).toBe(rows.length);
    });

    /**
     * A NULL row must not be counted as an audience member.
     *
     * This is the whole point of migration 20261005020000. `.eq('do_not_email',
     * false)` in SQL is NULL for a null row and NULL is not true, so the resolver
     * needed no change — but that is a property of SQL rather than of this code,
     * and the mock evaluates `.eq`/`.is` separately precisely so a rewrite to
     * `neq` or a client-side filter would be caught here.
     */
    it('never counts a never-asked contact as reachable', async () => {
      const rows = [{ id: 'c1', email: 'a@example.com', do_not_email: null, status: 'supporter' }];
      tables.crm_contacts = { rows, filterRows: rows };

      const count = await getBroadcastRecipientCount({});

      expect(count.count).toBe(0);
      expect(count.excludedCount).toBe(1);
    });

    it('queues the broadcast and dispatches it to the background sender', async () => {
      // Delivery no longer happens inside this action. It used to send five
      // recipients per sequential round-trip within one request, which the
      // platform killed past ~1,000 recipients, leaving the row stuck at
      // 'sending' forever. The action now only queues and dispatches.
      // Consent is applied while the audience resolves, so the opted-out contact
      // is present and must not arrive: three rows in, two recipients out.
      const rows = [
        {
          id: 'u1',
          email: 'vol1@example.com',
          first_name: 'Alice',
          last_name: 'Smith',
          unsubscribe_token: 't1',
          do_not_email: false,
          status: 'active_volunteer',
        },
        {
          id: 'u2',
          email: 'vol2@example.com',
          first_name: 'Bob',
          last_name: 'Jones',
          unsubscribe_token: 't2',
          do_not_email: false,
          status: 'active_volunteer',
        },
        {
          id: 'u3',
          email: 'opted-out@example.com',
          first_name: 'Cleo',
          last_name: 'Opted',
          unsubscribe_token: 't3',
          do_not_email: true,
          status: 'active_volunteer',
        },
        {
          /*
            Never asked. Added after the migration made NULL expressible, and
            seeded with the *same* shape as the two reachable rows so that
            dropping it from the audience cannot be an artefact of a field
            differing for any other reason.

            This is the assertion the whole tri-state change rests on: the
            resolver requires `do_not_email IS FALSE`, and a person the chapter
            has never asked must not be mailed.
          */
          id: 'u4',
          email: 'never-asked@example.com',
          first_name: 'Nia',
          last_name: 'Unasked',
          unsubscribe_token: 't4',
          do_not_email: null,
          status: 'active_volunteer',
        },
      ];
      tables.crm_contacts = { rows };
      tables.crm_broadcasts = { rows: [], insert: { id: 'broadcast-uuid-1' } };
      tables.crm_activities = { rows: [] };

      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      global.fetch = mockFetch;
      mockEnv.CRM_BROADCAST_FUNCTION_URL =
        'https://project.supabase.co/functions/v1/crm-broadcast-send';
      mockEnv.SUPABASE_SECRET_KEY = 'service-key';

      const res = await sendCRMBroadcast({
        subject: 'Chapter Meeting Next Tuesday',
        body: 'Please attend our monthly general meeting.',
        targetStatus: ['active_volunteer'],
      });

      expect(res.success).toBe(true);
      // Four rows in, two recipients out: one declined and one never asked are
      // both outside the audience, and neither is counted as delivered.
      expect(res.recipientCount).toBe(2);
      expect(res.broadcastId).toBe('broadcast-uuid-1');
      // Two fetch calls: the health pre-flight GET and the dispatch POST.
      // This action must not send any mail itself.
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(JSON.parse((mockFetch.mock.calls[1][1] as { body: string }).body)).toEqual({
        broadcast_id: 'broadcast-uuid-1',
      });
      // The log row that was written is 'queued', not 'sending' — the sender
      // owns that transition, and only once it has actually claimed the run.
      expect(tables.crm_broadcasts.rows?.[0]).toMatchObject({
        status: 'queued',
        recipient_count: 2,
        created_by: 'admin-user-uuid-1234',
      });
    });

    it('fails the broadcast visibly when the sender is not configured', async () => {
      // Without this, an unconfigured deployment would report a queued broadcast
      // that never goes anywhere. The audience resolves first, so there must be
      // recipients for the dispatch attempt to be the failing step.
      mockEnv.CRM_BROADCAST_FUNCTION_URL = undefined;
      tables.crm_contacts = {
        rows: [
          {
            id: 'u1',
            email: 'vol1@example.com',
            first_name: 'Alice',
            last_name: 'Smith',
            unsubscribe_token: 't1',
            do_not_email: false,
            status: 'supporter',
          },
        ],
      };
      tables.crm_broadcasts = { rows: [], insert: { id: 'b1' } };

      const res = await sendCRMBroadcast({ subject: 'Hi', body: 'Hello there' });
      expect(res.success).toBe(false);
      expect(res.error).toContain('not configured');
      // The row is marked failed rather than left queued forever, so the admin
      // sees that nothing went out and can retry. The old suite asserted only
      // that the broadcasts table had been *touched*, which is equally true of a
      // row still sitting at 'queued' — the state an operator would read as a
      // campaign that is merely slow.
      expect(tables.crm_broadcasts.rows?.[0]).toMatchObject({ status: 'failed' });
      expect(tables.crm_broadcasts.rows?.[0]?.sent_at).toBeTruthy();
    });

    it('refuses an empty audience rather than logging a no-op campaign', async () => {
      mockEnv.CRM_BROADCAST_FUNCTION_URL = undefined;
      tables.crm_contacts = { rows: [] };
      tables.crm_broadcasts = { rows: [] };

      const res = await sendCRMBroadcast({ subject: 'Hi', body: 'Hello there' });
      expect(res.success).toBe(false);
      expect(res.error).toContain('No contacts match');
      // No campaign row was written, so the history does not show a broadcast
      // that never had an audience.
      expect(tables.crm_broadcasts.rows).toHaveLength(0);
    });

    it('fails the broadcast when the recipient query errors', async () => {
      // The recipient-resolution loop throws when the database errors mid-query,
      // and sendCRMBroadcast must turn that into a failed row, not an uncaught throw.
      // Use a distinct admin identity to avoid spending the shared rate-limit slot.
      const savedId = session.adminUserId;
      session.adminUserId = 'admin-user-recip-err-uuid';
      try {
        tables.crm_contacts = { rows: [], error: { message: 'recipient query timeout' } };
        tables.crm_broadcasts = { rows: [], insert: { id: 'b-err' } };

        const res = await sendCRMBroadcast({ subject: 'Hi', body: 'Body' });

        expect(res.success).toBe(false);
        expect(res.error).toMatch(/recipient query timeout/i);
      } finally {
        session.adminUserId = savedId;
      }
    });

    it('treats a 200 with a non-JSON body as a bare success (no warning)', async () => {
      const rows = [
        {
          id: 'u1',
          email: 'v@example.com',
          first_name: 'V',
          last_name: 'X',
          unsubscribe_token: 't1',
          do_not_email: false,
          status: 'supporter',
        },
      ];
      tables.crm_contacts = { rows };
      tables.crm_broadcasts = { rows: [], insert: { id: 'b-nonjson' } };

      mockEnv.CRM_BROADCAST_FUNCTION_URL =
        'https://project.supabase.co/functions/v1/crm-broadcast-send';
      mockEnv.SUPABASE_SECRET_KEY = 'service-key';

      // Both the health pre-flight GET and the dispatch POST return ok:true with
      // no valid JSON body. The pre-flight's json() throw is caught by the outer
      // try/catch (proceeds), and the dispatch's json() throw is caught by the
      // inner try/catch (bare success, no warning).
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      });

      const res = await sendCRMBroadcast({ subject: 'Hi', body: 'Body' });

      expect(res.success).toBe(true);
      expect(res.warning).toBeUndefined();
    });

    it('fails the broadcast when the health pre-flight reports missing secrets', async () => {
      // Use a distinct admin identity to avoid spending the shared rate-limit slot.
      const savedId = session.adminUserId;
      session.adminUserId = 'admin-user-preflight-test-uuid';
      try {
        const rows = [
          {
            id: 'u1',
            email: 'v@example.com',
            first_name: 'V',
            last_name: 'X',
            unsubscribe_token: 't1',
            do_not_email: false,
            status: 'supporter',
          },
        ];
        tables.crm_contacts = { rows };
        tables.crm_broadcasts = { rows: [], insert: { id: 'b-preflight' } };

        mockEnv.CRM_BROADCAST_FUNCTION_URL =
          'https://project.supabase.co/functions/v1/crm-broadcast-send';
        mockEnv.SUPABASE_SECRET_KEY = 'service-key';

        // Health pre-flight returns ready: false — dispatch must not proceed.
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ ready: false, missing: ['RESEND_API_KEY'] }),
        });

        const res = await sendCRMBroadcast({ subject: 'Hi', body: 'Body' });

        expect(res.success).toBe(false);
        expect(res.error).toMatch(/RESEND_API_KEY/);
        // The broadcast row must be marked failed, not left queued.
        expect(tables.crm_broadcasts.rows?.[0]).toMatchObject({ status: 'failed' });
      } finally {
        session.adminUserId = savedId;
      }
    });
  });
});

describe('sendCRMBroadcastSelfTest', () => {
  // The existing mockEnv is scoped to an earlier suite; env is a live object, so
  // the same cast works here.
  const mockEnv = env as unknown as Record<string, string | undefined>;

  /**
   * Row sets, rebuilt per test — the same reasoning as the suite above, and
   * `clearAllMocks` keeps implementations, so a leftover `from` would keep
   * serving the previous test's broadcasts.
   */
  let tables: Record<string, MockTableConfig>;

  /** The campaign row that landed. Everything below asserts on this, not on a payload. */
  const broadcastRow = (): Record<string, unknown> | undefined => tables.crm_broadcasts.rows?.[0];

  /** Wire the mocks for a successful self-test and return the fetch mock. */
  const arrange = () => {
    // The row's id is generated by the database; `insert` supplies it, so the id
    // in the dispatch payload below is one the insert actually produced.
    tables.crm_broadcasts = { rows: [], insert: { id: 'test-broadcast-uuid' } };
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch;
    mockEnv.CRM_BROADCAST_FUNCTION_URL =
      'https://project.supabase.co/functions/v1/crm-broadcast-send';
    mockEnv.SUPABASE_SECRET_KEY = 'service-key';
    return { mockFetch };
  };

  // A distinct admin identity, so this suite's sends do not spend the 5/minute
  // budget that the other broadcast tests share. Restored afterwards.
  const originalId = session.adminUserId;

  beforeEach(() => {
    vi.clearAllMocks();
    tables = {};
    mockAdminClient.from.mockImplementation(createMockAdminClient(tables).from);
    session.adminUserId = 'admin-user-selftest-uuid';
    mockEnv.CRM_BROADCAST_FUNCTION_URL = undefined;
    mockEnv.SUPABASE_SECRET_KEY = undefined;
  });

  afterEach(() => {
    session.adminUserId = originalId;
  });

  it('addresses the signed-in admin and nobody else', async () => {
    // The recipient is read from the session, so this function has no way to
    // express "send this to someone else". A self-test that took a recipient
    // would be a blast button with a narrow default.
    arrange();
    const res = await sendCRMBroadcastSelfTest({
      subject: 'Chapter Meeting Next Tuesday',
      body: 'Please attend.',
    });

    expect(res.success).toBe(true);
    expect(res.recipient).toBe('organizer@indivisiblefairoaks.org');
    expect(broadcastRow()).toMatchObject({
      test_recipient: 'organizer@indivisiblefairoaks.org',
      test_only: true,
      recipient_count: 1,
    });
  });

  it('writes no audience filters, so there is nothing for the sender to widen', async () => {
    arrange();
    await sendCRMBroadcastSelfTest({ subject: 'Hi', body: 'There' });
    const row = broadcastRow();
    expect(row?.target_status).toBeUndefined();
    expect(row?.target_tags).toBeUndefined();
    expect(row?.target_districts).toBeUndefined();
  });

  it('marks the subject, so a stray preview is obvious in a real inbox', async () => {
    arrange();
    await sendCRMBroadcastSelfTest({ subject: 'Urgent: rally tomorrow', body: 'Body' });
    const row = broadcastRow() as { subject: string };
    expect(row.subject).toContain('[TEST');
    expect(row.subject).toContain('Urgent: rally tomorrow');
  });

  it('dispatches through the same sender, with only the id', async () => {
    const { mockFetch } = arrange();
    await sendCRMBroadcastSelfTest({ subject: 'Hi', body: 'There' });
    // Two fetch calls: the health pre-flight GET and the dispatch POST.
    expect(mockFetch).toHaveBeenCalledTimes(2);
    // The id dispatched is the id of the row in `tables.crm_broadcasts`, so this
    // also pins that the insert produced exactly one campaign.
    expect(JSON.parse((mockFetch.mock.calls[1][1] as { body: string }).body)).toEqual({
      broadcast_id: 'test-broadcast-uuid',
    });
  });

  it('refuses an empty subject or body without writing anything', async () => {
    arrange();
    expect((await sendCRMBroadcastSelfTest({ subject: '  ', body: 'x' })).error).toMatch(/Subject/);
    expect((await sendCRMBroadcastSelfTest({ subject: 'x', body: '  ' })).error).toMatch(/body/i);
    expect(tables.crm_broadcasts.rows).toHaveLength(0);
  });

  it('reports an unconfigured sender rather than claiming the test went out', async () => {
    arrange();
    mockEnv.CRM_BROADCAST_FUNCTION_URL = undefined;
    const res = await sendCRMBroadcastSelfTest({ subject: 'Hi', body: 'There' });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not configured/i);
    // Marked failed for the same reason a real broadcast is: a preview sitting
    // at 'queued' in the campaign log reads as a test that is merely slow.
    expect(broadcastRow()).toMatchObject({ status: 'failed' });
  });
});

describe('CRM sends are blocked in an e2e build', () => {
  // These paths dispatch to a live Edge Function that talks to Resend, and the
  // audience is a real constituent list. The contact form is safe in e2e only
  // because its notifier is redirected to a local mock; nothing does that here.
  const envState = env as unknown as Record<string, string | undefined>;
  const original = { test: envState.CONTACT_SUBMISSION_TEST_MODE, e2e: envState.NEXT_E2E_BUILD };
  const mockFetch = vi.fn();
  const originalId = session.adminUserId;
  let tables: Record<string, MockTableConfig>;

  beforeEach(() => {
    vi.clearAllMocks();
    tables = {};
    mockAdminClient.from.mockImplementation(createMockAdminClient(tables).from);
    session.adminUserId = 'admin-user-e2eguard-uuid';
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch;
  });

  afterEach(() => {
    session.adminUserId = originalId;
    envState.CONTACT_SUBMISSION_TEST_MODE = original.test;
    envState.NEXT_E2E_BUILD = original.e2e;
  });

  it('refuses a real broadcast', async () => {
    envState.CONTACT_SUBMISSION_TEST_MODE = '1';
    envState.NEXT_E2E_BUILD = 'true';
    const res = await sendCRMBroadcast({ subject: 'Rally tomorrow', body: 'Join us' });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/disabled in test builds/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('refuses a self-test send too', async () => {
    // A preview is harmless in isolation, but it still reaches Resend and the
    // chapter inbox, and a guard that only covers the dangerous path is a guard
    // someone will extend by accident.
    envState.CONTACT_SUBMISSION_TEST_MODE = '1';
    envState.NEXT_E2E_BUILD = 'true';
    const res = await sendCRMBroadcastSelfTest({ subject: 'Hi', body: 'There' });
    expect(res.success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('refuses a direct email too', async () => {
    envState.CONTACT_SUBMISSION_TEST_MODE = '1';
    envState.NEXT_E2E_BUILD = 'true';
    global.fetch = mockFetch;
    const res = await sendCRMDirectEmail({
      contactId: 'c-1',
      subject: 'Hi',
      message: 'There',
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/disabled in test builds/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('needs both flags, so CI cannot disable delivery by setting one', async () => {
    // NEXT_E2E_BUILD alone is true of any CI build, where sending is wanted.
    envState.CONTACT_SUBMISSION_TEST_MODE = undefined;
    envState.NEXT_E2E_BUILD = 'true';
    // The audience is empty, so the send fails for that reason rather than being
    // refused by the test-build guard.
    tables.crm_contacts = { rows: [] };
    tables.crm_broadcasts = { rows: [] };
    envState.CRM_BROADCAST_FUNCTION_URL =
      'https://project.supabase.co/functions/v1/crm-broadcast-send';
    envState.SUPABASE_SECRET_KEY = 'service-key';

    const res = await sendCRMBroadcast({ subject: 'Rally', body: 'Join us' });

    // What this asserts is which reason: not the test-build guard.
    expect(res.success).toBe(false);
    expect(res.error).not.toMatch(/disabled in test builds/i);
    expect(res.error).toContain('No contacts match');
    expect(tables.crm_broadcasts.rows).toHaveLength(0);
  });
});

/**
 * Regression tests for the four broadcast-safety defects.
 *
 * Each one shipped behind a comment that asserted the opposite of what the code
 * did, which is why they need pinning rather than a re-read. The invariant
 * names in each test are the ones to keep.
 */
describe('Broadcast blast radius', () => {
  const originalFetch = global.fetch;
  const envState = env as unknown as Record<string, string | undefined>;
  const originalId = session.adminUserId;
  const originalFunctionUrl = envState.CRM_BROADCAST_FUNCTION_URL;
  let tables: Record<string, MockTableConfig>;

  beforeEach(() => {
    vi.clearAllMocks();
    tables = {};
    mockAdminClient.from.mockImplementation(createMockAdminClient(tables).from);
    session.adminUserId = 'admin-user-blast-uuid';
    envState.RESEND_API_KEY = 're_test_key_dummy';
    envState.CRM_BROADCAST_FUNCTION_URL =
      'https://project.supabase.co/functions/v1/crm-broadcast-send';
    envState.SUPABASE_SECRET_KEY = 'service-key';
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    envState.CRM_BROADCAST_FUNCTION_URL = originalFunctionUrl;
    session.adminUserId = originalId;
  });

  /**
   * The ceiling refusal was dead code. `resolveBroadcastRecipients` paged with
   * `offset < CEILING`, so it returned at most exactly CEILING rows, and the
   * caller then compared `length > CEILING` — which is never true. A twelve
   * thousand contact audience was cut to five thousand and sent as `sent`, with
   * the organizer believing everyone had heard from them.
   *
   * The fix is the `exhausted` flag: only a query that ran dry proves the list
   * is complete. A full final page means there may be more.
   */
  it('refuses an audience larger than the ceiling instead of truncating it', async () => {
    // Six full pages of a thousand, which is what it takes for the resolver to
    // reach the ceiling without ever reading a short page — the audience is
    // 6,000 rows and the loop stops because it ran out of permission, not
    // because a query came back empty. The old suite answered every `.range()`
    // with the same canned full page out of a `Once` queue; the offset paging is
    // real here, so what the ceiling test depends on is what it would page over.
    const rows = Array.from({ length: 6000 }, (_, i) => ({
      id: `c${String(i).padStart(5, '0')}`,
      email: `vol${i}@example.com`,
      do_not_email: false,
      status: 'supporter',
    }));
    tables.crm_contacts = { rows };
    tables.crm_broadcasts = { rows: [] };

    const res = await sendCRMBroadcast({ subject: 'Rally', body: 'Join us' });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/larger than the 5,000 limit/i);
    // The refusal must happen before the row is written, or the campaign history
    // shows a broadcast that was never sent. Asserted on the table rather than on
    // the list of tables the client touched.
    expect(tables.crm_broadcasts.rows).toHaveLength(0);
  });

  /**
   * The other half of the ceiling fix, and the one thing a row-based mock
   * cannot show on its own.
   *
   * `.range()` is offset paging, which is coherent only against a total order
   * that does not change between statements. PostgREST emits no `order`
   * parameter when none is given, so both resolvers were reading `crm_contacts`
   * in whatever order it happened to return — and a contact who opted out, or a
   * CSV import that landed, between page 3 and page 4 shifted every later row by
   * one. The boundary contact was then mailed **twice** and `recipient_count`
   * was wrong.
   *
   * The audience never leaves `resolveBroadcastRecipients`: the actions return a
   * count, and a count is identical whether the pages were taken in primary-key
   * order or in whatever order the rows arrived. So no assertion about rows can
   * distinguish them, and this one asks the client what it was told to order by.
   * It is recorded rather than asserted on a hand-rolled stub, so the query still
   * has to select the rows for the rest of the test to mean anything.
   */
  it('pages the audience by primary key, not by the order rows happened to arrive in', async () => {
    // Descending, so insertion order and key order disagree — which is exactly
    // the situation the ordering is there to survive.
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      id: `c${String(999 - i).padStart(5, '0')}`,
      email: `vol${999 - i}@example.com`,
      do_not_email: false,
      status: 'supporter',
    }));
    tables.crm_contacts = { rows };
    tables.crm_broadcasts = { rows: [], insert: { id: 'bcast-ordered' } };
    const recorder = createMockAdminClient(tables, { recordFilters: true });
    mockAdminClient.from.mockImplementation(recorder.from);

    const res = await sendCRMBroadcast({ subject: 'Rally', body: 'Join us' });

    expect(res.success).toBe(true);
    // `id` is the primary key, ascending: the stable total order the paging
    // depends on. Deleting this `.order()` — or ordering on any other column —
    // is the regression this test exists to fail on.
    expect(recorder.orderCalls).toContainEqual({ column: 'id', ascending: true });
  });

  it('sends when the audience page runs dry before the ceiling', async () => {
    // Exactly one page: the second `.range(1000, 1999)` finds nothing, and that
    // empty result is the only evidence the list is complete.
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      id: `c${String(i).padStart(5, '0')}`,
      email: `vol${i}@example.com`,
      do_not_email: false,
      status: 'supporter',
    }));
    tables.crm_contacts = { rows };
    tables.crm_broadcasts = { rows: [], insert: { id: 'bcast-1' } };

    const res = await sendCRMBroadcast({ subject: 'Rally', body: 'Join us' });

    expect(res.success).toBe(true);
    expect(res.recipientCount).toBe(1000);
    expect(tables.crm_broadcasts.rows?.[0]).toMatchObject({
      status: 'queued',
      recipient_count: 1000,
    });
  });

  /**
   * `crm_broadcasts.created_by` was added in 20260929140000 so a blast had an
   * attributable author, and all three inserts omitted it. A campaign log where
   * nobody owns the campaign is not an audit trail.
   */
  it('stamps the author on a real broadcast', async () => {
    tables.crm_contacts = {
      rows: [{ id: 'c1', email: 'a@b.co', do_not_email: false, status: 'supporter' }],
    };
    tables.crm_broadcasts = { rows: [], insert: { id: 'bcast-2' } };

    await sendCRMBroadcast({ subject: 'Rally', body: 'Join us' });

    expect(tables.crm_broadcasts.rows?.[0]?.created_by).toBe('admin-user-blast-uuid');
  });

  it('stamps the author on a self-test', async () => {
    tables.crm_broadcasts = { rows: [], insert: { id: 'bcast-3' } };

    await sendCRMBroadcastSelfTest({ subject: 'Hi', body: 'There' });

    const row = tables.crm_broadcasts.rows?.[0];
    expect(row?.created_by).toBe('admin-user-blast-uuid');
    // The narrowing invariant: a self-test row carries no audience at all. If it
    // ever gains one, the edge function's `!isSelfTest` guard is the only thing
    // between a preview and the whole list.
    expect(row?.test_only).toBe(true);
    expect(row?.test_recipient).toBe('organizer@indivisiblefairoaks.org');
    expect(row?.target_tags).toBeUndefined();
    expect(row?.target_status).toBeUndefined();
    expect(row?.target_districts).toBeUndefined();
  });
});

/**
 * `crm-broadcast-send` read the self-test flag as
 * `test_only === true && typeof test_recipient === 'string'`. Both columns are
 * nullable and no CHECK tied them together, so a `test_only` row with a NULL
 * `test_recipient` fell out of the branch and ran the *audience* loop — mailing
 * every opted-in contact. The function now refuses, and migration
 * 20260930120000 makes the row unrepresentable.
 *
 * This is the app-side half of that pairing: the action must never be the thing
 * that writes a self-test with an address the sender cannot use.
 */
describe('Self-test narrowing is unrepresentable', () => {
  const originalFetch = global.fetch;
  const envState = env as unknown as Record<string, string | undefined>;
  const originalId = session.adminUserId;
  const originalEmail = session.adminEmail;
  let tables: Record<string, MockTableConfig>;

  beforeEach(() => {
    vi.clearAllMocks();
    tables = {};
    mockAdminClient.from.mockImplementation(createMockAdminClient(tables).from);
    session.adminUserId = 'admin-user-selftest-uuid';
    envState.CRM_BROADCAST_FUNCTION_URL =
      'https://project.supabase.co/functions/v1/crm-broadcast-send';
    envState.SUPABASE_SECRET_KEY = 'service-key';
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    session.adminUserId = originalId;
    session.adminEmail = originalEmail;
  });

  it('refuses to send when the session has no email to address the test to', async () => {
    // Writing `test_only: true` with a null `test_recipient` is exactly the row
    // the sender used to widen into a full broadcast. The action must never
    // create it, so it declines before the insert.
    session.adminEmail = undefined as unknown as string;
    tables.crm_broadcasts = { rows: [] };

    const res = await sendCRMBroadcastSelfTest({ subject: 'Hi', body: 'There' });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/no email address/i);
    expect(tables.crm_broadcasts.rows).toHaveLength(0);
    // An empty table only proves no row *survived*. `from` having never been
    // called is what pins the ordering — declined before the insert rather than
    // inserted and then abandoned — and there is no row-based way to express
    // that, because an inserted row that was then discarded looks identical to
    // no row at all.
    expect(mockAdminClient.from).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

/**
 * Drafts were insert-only. Pressing "Save draft" twice left two rows, the
 * composer's handle to the intended one lived in component state, and a reload
 * orphaned it — so a draft became a log entry nobody could find or remove.
 */
describe('Broadcast drafts are a document, not a log entry', () => {
  const originalFetch = global.fetch;
  const originalId = session.adminUserId;
  let tables: Record<string, MockTableConfig>;

  beforeEach(() => {
    vi.clearAllMocks();
    tables = {};
    mockAdminClient.from.mockImplementation(createMockAdminClient(tables).from);
    session.adminUserId = 'admin-user-draft-uuid';
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    session.adminUserId = originalId;
  });

  it('inserts once when there is no id yet', async () => {
    tables.crm_broadcasts = { rows: [], insert: { id: 'draft-1' } };

    const res = await saveCRMBroadcastDraft({
      subject: 'Draft',
      body: 'Later',
      targetTags: ['Choir', ' DONOR '],
    });

    expect(res.success).toBe(true);
    expect(res.broadcastId).toBe('draft-1');
    expect(tables.crm_broadcasts.rows?.[0]).toMatchObject({ target_tags: ['choir', 'donor'] });
    // One row, and it is a draft. The old assertion was that `.insert()` had been
    // called once and `.update()` not at all; "the table holds exactly one draft"
    // says the same thing about the state a reload would find.
    expect(tables.crm_broadcasts.rows).toHaveLength(1);
    expect(tables.crm_broadcasts.rows?.[0]).toMatchObject({
      id: 'draft-1',
      subject: 'Draft',
      status: 'draft',
      recipient_count: 0,
      created_by: 'admin-user-draft-uuid',
    });
  });

  it('updates in place when the id is known, so a second save does not duplicate', async () => {
    tables.crm_broadcasts = {
      rows: [{ id: 'draft-1', status: 'draft', subject: 'Draft', body: 'Later', target_tags: [] }],
    };

    const res = await saveCRMBroadcastDraft({
      broadcastId: 'draft-1',
      subject: 'Draft, revised',
      body: 'Better copy',
    });

    expect(res.success).toBe(true);
    expect(res.broadcastId).toBe('draft-1');
    // Still one row, carrying the new copy. A save that inserted instead of
    // updating — the defect this suite exists for — would leave two here, which
    // the old "update called once, insert not called" pair could not rule out
    // while asserting only on a stub's call log.
    expect(tables.crm_broadcasts.rows).toHaveLength(1);
    expect(tables.crm_broadcasts.rows?.[0]).toMatchObject({
      subject: 'Draft, revised',
      body: 'Better copy',
    });
  });

  it('scopes the update to a still-draft row, so a sent campaign is never rewritten', async () => {
    // The condition lives in the WHERE clause, not in a JS check: a draft that
    // was sent between the composer rendering and the save must not be mutated.
    // Expressed as the row's own `status`, which is what the clause reads.
    tables.crm_broadcasts = {
      rows: [{ id: 'draft-1', status: 'sent', subject: 'Real campaign', body: 'Body' }],
    };

    const res = await saveCRMBroadcastDraft({
      broadcastId: 'draft-1',
      subject: 'Draft',
      body: 'Body',
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/no longer a draft/i);
    // Untouched: a sent campaign keeps the copy it was sent with. Under the old
    // suite this was an assertion that `.eq('status', 'draft')` had been called,
    // which a clause on the wrong column records identically.
    expect(tables.crm_broadcasts.rows).toHaveLength(1);
    expect(tables.crm_broadcasts.rows?.[0]).toMatchObject({
      status: 'sent',
      subject: 'Real campaign',
    });
  });
});
