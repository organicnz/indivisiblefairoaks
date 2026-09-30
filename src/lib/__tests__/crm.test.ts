import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
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
  saveCRMContact,
  saveCRMSegment,
  sendCRMBroadcast,
  sendCRMBroadcastSelfTest,
  sendCRMDirectEmail,
  setCRMEmailConsent,
  setCRMTaskStatus,
} from '@/lib/actions/crm';

import { env } from '@/lib/env';

// Helper to create a chainable query builder
function createMockQueryBuilder(terminalResult: Record<string, unknown> = {}) {
  const promise = Promise.resolve(terminalResult);
  const qb = Object.assign(promise, {
    select: vi.fn(() => qb),
    insert: vi.fn(() => qb),
    update: vi.fn(() => qb),
    delete: vi.fn(() => qb),
    eq: vi.fn(() => qb),
    neq: vi.fn(() => qb),
    in: vi.fn(() => qb),
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

function firstMockArg<T>(fn: { mock: { calls: unknown[][] } }): T {
  return fn.mock.calls[0]?.[0] as T;
}

describe('Civic CRM Server Actions', () => {
  const originalFetch = global.fetch;
  const mockEnv = env as unknown as Record<string, string | undefined>;
  const originalApiKey = mockEnv.RESEND_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
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
      const qbContact = createMockQueryBuilder({
        data: { id: 'new-contact-123' },
        error: null,
      });
      const qbActivity = createMockQueryBuilder({
        data: null,
        error: null,
      });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'crm_contacts') return qbContact;
        if (table === 'crm_activities') return qbActivity;
        return createMockQueryBuilder();
      });

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
      expect(qbContact.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'activist@indivisiblefairoaks.org',
          first_name: 'Jane',
          status: 'active_volunteer',
          source: 'manual',
        })
      );
      expect(qbActivity.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          contact_id: 'new-contact-123',
          type: 'note',
          title: 'Constituent Created',
          created_by: 'admin-user-uuid-1234',
        })
      );
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
      const qbContact = createMockQueryBuilder({
        data: { id: validUuid },
        error: null,
      });
      const qbActivity = createMockQueryBuilder({
        data: null,
        error: null,
      });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'crm_contacts') return qbContact;
        if (table === 'crm_activities') return qbActivity;
        return createMockQueryBuilder();
      });

      const res = await saveCRMContact({
        id: validUuid,
        email: 'jane@example.com',
        first_name: 'Jane',
        status: 'organizer',
        tags: ['leadership'],
      });

      expect(res.success).toBe(true);
      expect(res.contactId).toBe(validUuid);
      expect(qbContact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'Jane',
          status: 'organizer',
        })
      );
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
      mockAdminClient.from.mockReturnValue(createMockQueryBuilder());

      const stats = await getCRMStats();
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
      mockAdminClient.from.mockReturnValue(createMockQueryBuilder());

      const stats = await getCRMStats();
      expect(stats.totalContacts).toBe(0);
      expect(stats.totalDonationsCents).toBe(0);
    });

    it('falls back to per-table counts when the migration has not been applied', async () => {
      // Staged rollout: a database without crm_stats() must still render the
      // dashboard rather than 500 for every admin.
      mockAdminClient.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'function public.crm_stats() does not exist' },
      });
      mockAdminClient.from.mockReturnValue(createMockQueryBuilder({ count: 3 }));

      const stats = await getCRMStats();
      expect(stats.totalContacts).toBe(3);
      expect(stats.openTasks).toBe(3);
      expect(stats.totalDonationsCents).toBe(0);
    });
  });

  describe('getCRMContacts', () => {
    it('applies query filters and pagination range', async () => {
      const qb = createMockQueryBuilder({
        data: [{ id: '1', email: 'test@example.com' }],
        count: 1,
        error: null,
      });

      mockAdminClient.from.mockReturnValue(qb);

      const res = await getCRMContacts({
        status: 'active_volunteer',
        district: 'CA-06',
        tag: 'choir',
        query: 'jane',
        page: 2,
        pageSize: 10,
      });

      expect(qb.eq).toHaveBeenCalledWith('status', 'active_volunteer');
      expect(qb.eq).toHaveBeenCalledWith('district', 'CA-06');
      expect(qb.contains).toHaveBeenCalledWith('tags', ['choir']);
      expect(qb.textSearch).toHaveBeenCalledWith(
        'search_vector',
        'jane',
        expect.objectContaining({ type: 'websearch', config: 'simple' })
      );
      expect(qb.range).toHaveBeenCalledWith(10, 19);
      expect(res.contacts).toHaveLength(1);
    });

    it('falls back to ILIKE when FTS returns no rows', async () => {
      const qbEmpty = createMockQueryBuilder({ data: [], count: 0, error: null });
      const qbIlike = createMockQueryBuilder({
        data: [{ id: '1', email: 'jane@example.com' }],
        count: 1,
        error: null,
      });
      let call = 0;
      mockAdminClient.from.mockImplementation(() => {
        call += 1;
        return call === 1 ? qbEmpty : qbIlike;
      });

      const res = await getCRMContacts({ query: 'jane', pageSize: 10 });

      expect(qbEmpty.textSearch).toHaveBeenCalled();
      expect(qbIlike.or).toHaveBeenCalledWith(expect.stringContaining('email.ilike'));
      expect(res.contacts).toHaveLength(1);
      expect(res.totalCount).toBe(1);
    });

    it('strips PostgREST .or() structural characters from the ILIKE fallback query', async () => {
      const qbEmpty = createMockQueryBuilder({ data: [], count: 0, error: null });
      const qbIlike = createMockQueryBuilder({ data: [], count: 0, error: null });
      let call = 0;
      mockAdminClient.from.mockImplementation(() => {
        call += 1;
        return call === 1 ? qbEmpty : qbIlike;
      });

      await getCRMContacts({ query: 'foo (bar), baz', pageSize: 10 });

      const orFilter = firstMockArg<string>(qbIlike.or);
      expect(orFilter).not.toContain('(');
      expect(orFilter).not.toContain(')');
      // Commas only appear as .or() separators between column filters.
      expect(orFilter.split(',').length).toBeGreaterThanOrEqual(5);
      expect(orFilter).toContain('foo bar baz');
    });
  });

  describe('exportCRMContacts', () => {
    it('returns a CSV covering the full filtered set', async () => {
      const qb = createMockQueryBuilder({
        data: [
          {
            id: 'c1',
            email: 'a@example.com',
            first_name: 'A',
            last_name: null,
            phone: null,
            district: 'CA-06',
            city: null,
            zip_code: null,
            status: 'supporter',
            tags: ['choir'],
            do_not_email: true,
            total_donated_cents: 1000,
            source: 'import',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        count: 1,
        error: null,
      });
      mockAdminClient.from.mockReturnValue(qb);

      const res = await exportCRMContacts({ status: 'supporter' });
      expect(res.error).toBeUndefined();
      expect(res.count).toBe(1);
      expect(res.csv).toContain('Do Not Email');
      expect(res.csv).toContain('a@example.com');
      expect(res.csv).toContain('yes');
      expect(qb.range).toHaveBeenCalledWith(0, 9999);
    });
  });

  describe('tasks', () => {
    it('adds an open task for a contact', async () => {
      const qb = createMockQueryBuilder({ data: { id: 'task-1' }, error: null });
      mockAdminClient.from.mockReturnValue(qb);

      const res = await addCRMTask({
        contactId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
        title: 'Call about canvass',
        dueAt: '2026-10-01',
      });

      expect(res.success).toBe(true);
      expect(qb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          contact_id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
          title: 'Call about canvass',
          due_at: '2026-10-01',
          created_by: 'admin-user-uuid-1234',
        })
      );
    });

    it('rejects an empty task title', async () => {
      const res = await addCRMTask({
        contactId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
        title: '   ',
      });
      expect(res.success).toBe(false);
    });

    it('marks a task done with completed_at', async () => {
      const qb = createMockQueryBuilder({ error: null });
      mockAdminClient.from.mockReturnValue(qb);

      const res = await setCRMTaskStatus({ id: 'task-1', status: 'done' });
      expect(res.success).toBe(true);
      expect(qb.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }));
      const payload = firstMockArg<{ completed_at: string | null }>(qb.update);
      expect(payload.completed_at).toBeTruthy();
    });

    it('reopening a task clears completed_at', async () => {
      const qb = createMockQueryBuilder({ error: null });
      mockAdminClient.from.mockReturnValue(qb);

      const res = await setCRMTaskStatus({ id: 'task-1', status: 'open' });
      expect(res.success).toBe(true);
      const payload = firstMockArg<{ completed_at: string | null }>(qb.update);
      expect(payload.completed_at).toBeNull();
    });

    it('deletes a task by id', async () => {
      const qb = createMockQueryBuilder({ error: null });
      mockAdminClient.from.mockReturnValue(qb);

      const res = await deleteCRMTask('task-1');
      expect(res.success).toBe(true);
      expect(qb.delete).toHaveBeenCalled();
      expect(qb.eq).toHaveBeenCalledWith('id', 'task-1');
    });

    it('lists open tasks scoped with status filter', async () => {
      const qb = createMockQueryBuilder({ data: [], count: 0, error: null });
      mockAdminClient.from.mockReturnValue(qb);

      const res = await getCRMTasks({ scope: 'open' });
      expect(res.totalCount).toBe(0);
      expect(qb.eq).toHaveBeenCalledWith('status', 'open');
    });
  });

  describe('segments', () => {
    it('saves a new named segment', async () => {
      const qb = createMockQueryBuilder({ data: { id: 'seg-1' }, error: null });
      mockAdminClient.from.mockReturnValue(qb);

      const res = await saveCRMSegment({
        name: 'CA-06 choir',
        query: '',
        statuses: ['choir'],
        districts: ['CA-06'],
        tags: [],
      });

      expect(res.success).toBe(true);
      expect(qb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'CA-06 choir',
          statuses: ['choir'],
          districts: ['CA-06'],
        })
      );
    });

    it('rejects an empty segment name', async () => {
      const res = await saveCRMSegment({ name: '  ' });
      expect(res.success).toBe(false);
    });
  });

  describe('consent', () => {
    it('marks do-not-email and logs an activity', async () => {
      const qbContact = createMockQueryBuilder({ error: null });
      const qbActivity = createMockQueryBuilder({ error: null });
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'crm_contacts') return qbContact;
        if (table === 'crm_activities') return qbActivity;
        return createMockQueryBuilder();
      });

      const res = await setCRMEmailConsent({
        contactId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
        doNotEmail: true,
      });

      expect(res.success).toBe(true);
      expect(qbContact.update).toHaveBeenCalledWith(
        expect.objectContaining({ do_not_email: true })
      );
      const payload = firstMockArg<{ unsubscribed_at: string | null }>(qbContact.update);
      expect(payload.unsubscribed_at).toBeTruthy();
      expect(qbActivity.insert).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Email Consent Revoked' })
      );
    });

    it('blocks direct email when contact is opted out', async () => {
      const qbContact = createMockQueryBuilder({
        data: {
          id: 'c-1',
          email: 'x@example.com',
          first_name: 'X',
          last_name: null,
          do_not_email: true,
          unsubscribe_token: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
        },
        error: null,
      });
      mockAdminClient.from.mockReturnValue(qbContact);

      const res = await sendCRMDirectEmail({
        contactId: 'c-1',
        subject: 'Hello',
        message: 'Hi there',
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/unsubscribed/i);
    });
  });

  describe('importCRMContacts', () => {
    it('parses CSV, skips existing emails, inserts new rows', async () => {
      // First call: .or(email.ilike…) lookup → { data: [{email}] }
      // Second call: insert → { data: [{id}] }
      let contactCall = 0;
      const existingQb = createMockQueryBuilder({
        data: [{ email: 'taken@example.com' }],
        error: null,
      });
      const insertQb = createMockQueryBuilder({ data: [{ id: 'new-1' }], error: null });
      // Case-insensitive pre-check uses .or(email.ilike…), not .in().
      existingQb.or = vi.fn(() => existingQb);
      insertQb.insert = vi.fn(() => insertQb);
      insertQb.select = vi.fn(() => insertQb);

      const qbActivity = createMockQueryBuilder({ error: null });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'crm_contacts') {
          contactCall += 1;
          // First crm_contacts call is the existing-email check (.or)
          // Second is the insert. We detect by which method is used after.
          return contactCall === 1 ? existingQb : insertQb;
        }
        if (table === 'crm_activities') return qbActivity;
        return createMockQueryBuilder();
      });

      const csv = [
        'email,first_name,last_name,status,tags',
        'taken@example.com,Taken,User,supporter,',
        'brand-new@example.com,New,Person,choir,postcards;canvass',
      ].join('\n');

      const res = await importCRMContacts({ csv });

      expect(res.success).toBe(true);
      expect(res.skipped).toBe(1);
      expect(res.imported).toBe(1);
      expect(existingQb.or).toHaveBeenCalledWith(
        expect.stringContaining('email.ilike.taken@example.com')
      );
      expect(insertQb.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            email: 'brand-new@example.com',
            status: 'choir',
            tags: ['postcards', 'canvass'],
            source: 'import',
          }),
        ])
      );
    });

    it('treats mixed-case DB emails as already imported (case-insensitive pre-check)', async () => {
      let contactCall = 0;
      const existingQb = createMockQueryBuilder({
        // DB retained mixed case; CSV parser lowercases input.
        data: [{ email: 'Taken@Example.COM' }],
        error: null,
      });
      const insertQb = createMockQueryBuilder({ data: [{ id: 'should-not-run' }], error: null });
      existingQb.or = vi.fn(() => existingQb);
      insertQb.insert = vi.fn(() => insertQb);
      insertQb.select = vi.fn(() => insertQb);

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'crm_contacts') {
          contactCall += 1;
          return contactCall === 1 ? existingQb : insertQb;
        }
        return createMockQueryBuilder();
      });

      const res = await importCRMContacts({
        csv: 'email,first_name\nTaken@Example.COM,Ada',
      });

      expect(res.success).toBe(true);
      expect(res.imported).toBe(0);
      expect(res.skipped).toBe(1);
      expect(insertQb.insert).not.toHaveBeenCalled();
    });

    it('fails closed when the existing-email lookup errors', async () => {
      const existingQb = createMockQueryBuilder({
        data: null,
        error: { message: 'permission denied for table crm_contacts' },
      });
      existingQb.or = vi.fn(() => existingQb);

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'crm_contacts') return existingQb;
        return createMockQueryBuilder();
      });

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
      const existingQb = createMockQueryBuilder({ data: [], error: null });
      existingQb.or = vi.fn(() => existingQb);
      const insertQb = createMockQueryBuilder({
        data: null,
        error: { message: 'violates check constraint "crm_contacts_source_check"' },
      });
      insertQb.insert = vi.fn(() => insertQb);
      insertQb.select = vi.fn(() => insertQb);

      let contactCall = 0;
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'crm_contacts') {
          contactCall += 1;
          return contactCall === 1 ? existingQb : insertQb;
        }
        return createMockQueryBuilder();
      });

      const csv = 'email\nnew-person@example.com';
      const res = await importCRMContacts({ csv });

      expect(res.success).toBe(false);
      expect(res.imported).toBe(0);
      expect(res.error).toMatch(/inserts failed/i);
      expect(res.errors?.some((e) => e.message.startsWith('Insert failed'))).toBe(true);
    });
  });

  describe('mergeCRMContacts', () => {
    it('refuses to merge a contact into itself', async () => {
      const res = await mergeCRMContacts({ keepId: 'same-id', removeId: 'same-id' });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/itself/);
    });

    it('moves activities, combines tags/donations, deletes duplicate', async () => {
      const keepContact = {
        id: 'keep-uuid',
        email: 'keep@example.com',
        first_name: 'Keep',
        last_name: null,
        tags: ['choir'],
        notes: 'keep note',
        total_donated_cents: 500,
        last_contacted_at: '2026-02-01T00:00:00Z',
        do_not_email: false,
        unsubscribed_at: null,
      };
      const removeContact = {
        id: 'remove-uuid',
        email: 'remove@example.com',
        first_name: 'Remove',
        last_name: null,
        tags: ['donor'],
        notes: 'remove note',
        total_donated_cents: 250,
        last_contacted_at: '2026-03-01T00:00:00Z',
        do_not_email: true,
        unsubscribed_at: '2026-03-05T00:00:00Z',
      };

      const qbKeep = createMockQueryBuilder({ data: keepContact, error: null });
      const qbRemove = createMockQueryBuilder({ data: removeContact, error: null });
      const qbActs = createMockQueryBuilder({ error: null });
      const qbTasks = createMockQueryBuilder({ error: null });
      const qbDelete = createMockQueryBuilder({ error: null });

      let fetchCount = 0;
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'crm_contacts') {
          // fetch keep, fetch remove, update keep, delete remove
          fetchCount += 1;
          if (fetchCount === 1) return qbKeep;
          if (fetchCount === 2) return qbRemove;
          if (fetchCount === 3) return qbKeep; // update
          return qbDelete;
        }
        if (table === 'crm_activities') return qbActs;
        if (table === 'crm_tasks') return qbTasks;
        return createMockQueryBuilder();
      });

      const res = await mergeCRMContacts({
        keepId: 'keep-uuid',
        removeId: 'remove-uuid',
      });

      expect(res.success).toBe(true);
      expect(qbActs.update).toHaveBeenCalledWith({ contact_id: 'keep-uuid' });
      expect(qbTasks.update).toHaveBeenCalledWith({ contact_id: 'keep-uuid' });
      expect(qbKeep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: expect.arrayContaining(['choir', 'donor']),
          total_donated_cents: 750,
          do_not_email: true,
        })
      );
      expect(qbDelete.delete).toHaveBeenCalled();
      expect(qbDelete.eq).toHaveBeenCalledWith('id', 'remove-uuid');
    });
  });

  describe('addCRMNote', () => {
    it('creates a note activity linked to the contact', async () => {
      const qb = createMockQueryBuilder({ data: null, error: null });
      mockAdminClient.from.mockReturnValue(qb);

      const res = await addCRMNote({
        contactId: 'contact-uuid-1',
        title: 'Attended Rally',
        description: 'Brought 4 neighbors and signed up for phonebank.',
      });

      expect(res.success).toBe(true);
      expect(qb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          contact_id: 'contact-uuid-1',
          type: 'note',
          title: 'Attended Rally',
          description: 'Brought 4 neighbors and signed up for phonebank.',
          created_by: 'admin-user-uuid-1234',
        })
      );
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
      const qbContact = createMockQueryBuilder({
        data: {
          id: 'c-1',
          email: 'neighbor@example.com',
          first_name: 'Neighbor',
          last_name: 'Person',
        },
        error: null,
      });
      const qbActivity = createMockQueryBuilder({ data: null, error: null });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'crm_contacts') return qbContact;
        if (table === 'crm_activities') return qbActivity;
        return createMockQueryBuilder();
      });

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
      expect(qbActivity.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          contact_id: 'c-1',
          type: 'email_sent',
          metadata: expect.objectContaining({ resend_id: 'resend_msg_123' }),
        })
      );
    });
  });

  describe('getBroadcastRecipientCount & sendCRMBroadcast', () => {
    it('calculates recipient count based on criteria', async () => {
      const qb = createMockQueryBuilder({ count: 28, error: null });
      mockAdminClient.from.mockReturnValue(qb);

      const count = await getBroadcastRecipientCount({
        targetStatus: ['active_volunteer'],
        targetDistricts: ['CA-06'],
        targetTags: ['choir'],
      });

      expect(count).toBe(28);
      expect(qb.in).toHaveBeenCalledWith('status', ['active_volunteer']);
      expect(qb.in).toHaveBeenCalledWith('district', ['CA-06']);
      expect(qb.contains).toHaveBeenCalledWith('tags', ['choir']);
    });

    it('queues the broadcast and dispatches it to the background sender', async () => {
      // Delivery no longer happens inside this action. It used to send five
      // recipients per sequential round-trip within one request, which the
      // platform killed past ~1,000 recipients, leaving the row stuck at
      // 'sending' forever. The action now only queues and dispatches.
      const recipients = [
        {
          id: 'u1',
          email: 'vol1@example.com',
          first_name: 'Alice',
          last_name: 'Smith',
          unsubscribe_token: 't1',
        },
        {
          id: 'u2',
          email: 'vol2@example.com',
          first_name: 'Bob',
          last_name: 'Jones',
          unsubscribe_token: 't2',
        },
      ];

      const qbContacts = createMockQueryBuilder({ data: recipients, error: null });
      const qbBroadcasts = createMockQueryBuilder({
        data: { id: 'broadcast-uuid-1' },
        error: null,
      });
      const qbActivities = createMockQueryBuilder({ data: null, error: null });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'crm_contacts') return qbContacts;
        if (table === 'crm_broadcasts') return qbBroadcasts;
        if (table === 'crm_activities') return qbActivities;
        return createMockQueryBuilder();
      });

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
      expect(res.recipientCount).toBe(2);
      expect(res.broadcastId).toBe('broadcast-uuid-1');
      // Exactly one call: the dispatch. This action must not send any mail.
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body)).toEqual({
        broadcast_id: 'broadcast-uuid-1',
      });
      // The log row is written as 'queued', not 'sending' — the sender owns
      // that transition, and only once it has actually claimed the run.
      expect(qbBroadcasts.insert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'queued', recipient_count: 2 })
      );
    });

    it('saves as scheduled without dispatching when scheduledAt is set', async () => {
      const qbBroadcasts = createMockQueryBuilder({ data: { id: 'b-sched' }, error: null });
      mockAdminClient.from.mockImplementation((table: string) =>
        table === 'crm_broadcasts'
          ? qbBroadcasts
          : createMockQueryBuilder({ data: null, error: null })
      );
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const res = await sendCRMBroadcast({
        subject: 'Scheduled rally reminder',
        body: 'See you at the rally.',
        scheduledAt: future,
      });

      expect(res.success).toBe(true);
      expect(res.recipientCount).toBe(0);
      // No dispatch: the scheduler owns the send when the time comes.
      expect(mockFetch).not.toHaveBeenCalled();
      expect(qbBroadcasts.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'scheduled',
          scheduled_at: future,
          recipient_count: 0,
        })
      );
    });

    it('rejects a scheduled time in the past', async () => {
      const qbBroadcasts = createMockQueryBuilder({ data: null, error: null });
      mockAdminClient.from.mockImplementation((table: string) =>
        table === 'crm_broadcasts'
          ? qbBroadcasts
          : createMockQueryBuilder({ data: null, error: null })
      );

      const past = new Date(Date.now() - 60 * 1000).toISOString();
      const res = await sendCRMBroadcast({
        subject: 'Too late',
        body: 'This should fail.',
        scheduledAt: past,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('future');
      expect(qbBroadcasts.insert).not.toHaveBeenCalled();
    });

    it('fails the broadcast visibly when the sender is not configured', async () => {
      // Without this, an unconfigured deployment would report a queued broadcast
      // that never goes anywhere. The audience resolves first, so the mock must
      // return recipients for the dispatch attempt to be the failing step.
      mockEnv.CRM_BROADCAST_FUNCTION_URL = undefined;
      mockAdminClient.from.mockImplementation((table: string) =>
        table === 'crm_contacts'
          ? createMockQueryBuilder({
              data: [
                {
                  id: 'u1',
                  email: 'vol1@example.com',
                  first_name: 'Alice',
                  last_name: 'Smith',
                  unsubscribe_token: 't1',
                },
              ],
              error: null,
            })
          : createMockQueryBuilder({ data: { id: 'b1' }, error: null })
      );

      const res = await sendCRMBroadcast({ subject: 'Hi', body: 'Hello there' });
      expect(res.success).toBe(false);
      expect(res.error).toContain('not configured');
      // The row is marked failed rather than left queued forever, so the admin
      // sees that nothing went out and can retry.
      expect(mockAdminClient.from).toHaveBeenCalledWith('crm_broadcasts');
    });

    it('refuses an empty audience rather than logging a no-op campaign', async () => {
      mockEnv.CRM_BROADCAST_FUNCTION_URL = undefined;
      mockAdminClient.from.mockImplementation((table: string) =>
        table === 'crm_contacts'
          ? createMockQueryBuilder({ data: [], error: null })
          : createMockQueryBuilder({ data: null, error: null })
      );

      const res = await sendCRMBroadcast({ subject: 'Hi', body: 'Hello there' });
      expect(res.success).toBe(false);
      expect(res.error).toContain('No contacts match');
    });
  });
});

describe('sendCRMBroadcastSelfTest', () => {
  // The existing mockEnv is scoped to an earlier suite; env is a live object, so
  // the same cast works here.
  const mockEnv = env as unknown as Record<string, string | undefined>;

  /**
   * The first argument passed to `insert`. The shared builder mock types
   * `insert()` as taking no arguments, so the recorded calls are zero-length
   * tuples and the payload has to be read through a wider view.
   */
  const insertedRow = (qb: { insert: { mock: { calls: unknown[][] } } }): Record<string, unknown> =>
    (qb.insert.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;

  /** Wire the mocks for a successful self-test and return the broadcasts builder. */
  const arrange = () => {
    const qbBroadcasts = createMockQueryBuilder({
      data: { id: 'test-broadcast-uuid' },
      error: null,
    });
    mockAdminClient.from.mockImplementation((table: string) =>
      table === 'crm_broadcasts' ? qbBroadcasts : createMockQueryBuilder()
    );
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch;
    mockEnv.CRM_BROADCAST_FUNCTION_URL =
      'https://project.supabase.co/functions/v1/crm-broadcast-send';
    mockEnv.SUPABASE_SECRET_KEY = 'service-key';
    return { qbBroadcasts, mockFetch };
  };

  // A distinct admin identity, so this suite's sends do not spend the 5/minute
  // budget that the other broadcast tests share. Restored afterwards.
  const originalId = session.adminUserId;

  beforeEach(() => {
    vi.clearAllMocks();
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
    const { qbBroadcasts } = arrange();
    const res = await sendCRMBroadcastSelfTest({
      subject: 'Chapter Meeting Next Tuesday',
      body: 'Please attend.',
    });

    expect(res.success).toBe(true);
    expect(res.recipient).toBe('organizer@indivisiblefairoaks.org');
    expect(qbBroadcasts.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        test_recipient: 'organizer@indivisiblefairoaks.org',
        test_only: true,
        recipient_count: 1,
      })
    );
  });

  it('writes no audience filters, so there is nothing for the sender to widen', async () => {
    const { qbBroadcasts } = arrange();
    await sendCRMBroadcastSelfTest({ subject: 'Hi', body: 'There' });
    const row = insertedRow(qbBroadcasts);
    expect(row.target_status).toBeUndefined();
    expect(row.target_tags).toBeUndefined();
    expect(row.target_districts).toBeUndefined();
  });

  it('marks the subject, so a stray preview is obvious in a real inbox', async () => {
    const { qbBroadcasts } = arrange();
    await sendCRMBroadcastSelfTest({ subject: 'Urgent: rally tomorrow', body: 'Body' });
    const row = insertedRow(qbBroadcasts) as { subject: string };
    expect(row.subject).toContain('[TEST');
    expect(row.subject).toContain('Urgent: rally tomorrow');
  });

  it('dispatches through the same sender, with only the id', async () => {
    const { mockFetch } = arrange();
    await sendCRMBroadcastSelfTest({ subject: 'Hi', body: 'There' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body)).toEqual({
      broadcast_id: 'test-broadcast-uuid',
    });
  });

  it('refuses an empty subject or body without writing anything', async () => {
    const { qbBroadcasts } = arrange();
    expect((await sendCRMBroadcastSelfTest({ subject: '  ', body: 'x' })).error).toMatch(/Subject/);
    expect((await sendCRMBroadcastSelfTest({ subject: 'x', body: '  ' })).error).toMatch(/body/i);
    expect(qbBroadcasts.insert).not.toHaveBeenCalled();
  });

  it('reports an unconfigured sender rather than claiming the test went out', async () => {
    arrange();
    mockEnv.CRM_BROADCAST_FUNCTION_URL = undefined;
    const res = await sendCRMBroadcastSelfTest({ subject: 'Hi', body: 'There' });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not configured/i);
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

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('needs both flags, so CI cannot disable delivery by setting one', async () => {
    // NEXT_E2E_BUILD alone is true of any CI build, where sending is wanted.
    envState.CONTACT_SUBMISSION_TEST_MODE = undefined;
    envState.NEXT_E2E_BUILD = 'true';
    const qb = createMockQueryBuilder({ data: [], count: 0, error: null });
    mockAdminClient.from.mockReturnValue(qb);
    envState.CRM_BROADCAST_FUNCTION_URL =
      'https://project.supabase.co/functions/v1/crm-broadcast-send';
    envState.SUPABASE_SECRET_KEY = 'service-key';

    const res = await sendCRMBroadcast({ subject: 'Rally', body: 'Join us' });

    // The audience is empty here, so the send fails for that reason. What this
    // asserts is which reason: not the test-build guard.
    expect(res.success).toBe(false);
    expect(res.error).not.toMatch(/disabled in test builds/i);
  });
});
