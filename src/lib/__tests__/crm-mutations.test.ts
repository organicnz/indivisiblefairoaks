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
    delete: vi.fn(() => qb),
    eq: vi.fn(() => qb),
    in: vi.fn(() => qb),
    or: vi.fn(() => qb),
    order: vi.fn(() => qb),
    limit: vi.fn(() => qb),
    range: vi.fn(() => Promise.resolve(terminalResult)),
    single: vi.fn(() => Promise.resolve(terminalResult)),
    maybeSingle: vi.fn(() => Promise.resolve(terminalResult)),
  });
  return qb;
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
      // happened.
      const qb = createMockQueryBuilder({ data: null, error: null });
      mockAdminClient.from.mockReturnValue(qb);

      const res = await saveCRMContact({
        id: '11111111-2222-4333-8444-555555555555',
        email: 'a@b.co',
        first_name: 'Robin',
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/no longer exists/i);
    });

    it('rejects an email that is not an email before touching the database', async () => {
      mockAdminClient.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));
      const res = await saveCRMContact({ email: 'not-an-email', first_name: 'Robin' });
      expect(res.success).toBe(false);
      expect(mockAdminClient.from).not.toHaveBeenCalled();
    });

    it('surfaces a duplicate email as a sentence rather than a Postgres code', async () => {
      // 23505 is what the database says. "That email is already in the
      // directory" is what the volunteer needs.
      const qb = createMockQueryBuilder({ data: null, error: { code: '23505' } });
      mockAdminClient.from.mockReturnValue(qb);

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
      mockAdminClient.from.mockReturnValue(
        createMockQueryBuilder({ data: null, error: { message: 'fk violation' } })
      );
      const res = await deleteCRMContact('11111111-2222-4333-8444-555555555555');
      expect(res.success).toBe(false);
      expect(res.error).toBe('fk violation');
    });

    it('deletes cleanly', async () => {
      const qb = createMockQueryBuilder({ data: null, error: null });
      mockAdminClient.from.mockReturnValue(qb);
      await expect(deleteCRMContact('11111111-2222-4333-8444-555555555555')).resolves.toEqual({
        success: true,
      });
      expect(qb.delete).toHaveBeenCalled();
    });
  });

  describe('addCRMNote', () => {
    it('refuses a note with no title', async () => {
      mockAdminClient.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));
      const res = await addCRMNote({ contactId: 'c1', title: '   ', description: '' });
      expect(res.success).toBe(false);
      expect(mockAdminClient.from).not.toHaveBeenCalled();
    });

    it('trims the title so the timeline is not full of padded headings', async () => {
      const qb = createMockQueryBuilder({ data: { id: 'a1' }, error: null });
      mockAdminClient.from.mockReturnValue(qb);

      await addCRMNote({ contactId: 'c1', title: '  Spoke at the fair  ', description: 'body' });

      const insert = callArg<Record<string, unknown>>(qb.insert);
      expect(insert.title).toBe('Spoke at the fair');
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
      mockAdminClient.from.mockReturnValue(
        createMockQueryBuilder({ data: null, error: { message: 'timeout' } })
      );

      const res = await importCRMContacts({ csv });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/lookup failed/i);
    });

    it('reports no success when every insert was rejected', async () => {
      mockAdminClient.from.mockReturnValue(
        createMockQueryBuilder({ data: null, error: { message: 'permission denied' } })
      );

      const res = await importCRMContacts({ csv });

      expect(res.success).toBe(false);
      // A green toast over an import that wrote nothing is the worst outcome
      // available here: the volunteer believes their list is loaded.
      expect(res.error).toBeTruthy();
    });

    it('carries the address column, so a restored backup keeps it', async () => {
      const withAddress = [
        'email,first_name,address',
        'a@example.org,Robin,4821 Fair Oaks Blvd',
      ].join('\n');
      // One builder for every call: the importer makes a pre-check read and then
      // a chunked insert, and a `Once` queue here leaks into the next test
      // because `vi.clearAllMocks` does not drain unconsumed one-shot values.
      const qb = createMockQueryBuilder({ data: [], error: null });
      mockAdminClient.from.mockReturnValue(qb);

      await importCRMContacts({ csv: withAddress });

      // The address the exporter wrote has to reach the row, or a restored
      // backup loses every street address in the chapter.
      const insert = callArg<Record<string, unknown>[]>(qb.insert);
      expect(Array.isArray(insert)).toBe(true);
      expect(insert?.[0]?.address).toBe('4821 Fair Oaks Blvd');
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
      // than being told it worked.
      const lookups = createMockQueryBuilder({ data: [], error: null });
      const update = createMockQueryBuilder({ data: null, error: null });
      const fail = createMockQueryBuilder({ data: null, error: { message: 'fk violation' } });
      mockAdminClient.from
        .mockReturnValueOnce(lookups)
        .mockReturnValueOnce(update)
        .mockReturnValueOnce(update)
        .mockReturnValueOnce(fail);

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
      // after.
      const optedOut = createMockQueryBuilder({
        data: { id: 'c1', email: 'a@b.co', do_not_email: true },
        error: null,
      });
      mockAdminClient.from.mockReturnValue(optedOut);

      const res = await sendCRMDirectEmail({ contactId: 'c1', subject: 'Hi', message: 'There' });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/do.not.email|unsubscribed|opted out/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('reports a contact that does not exist', async () => {
      freshAdmin();
      mockAdminClient.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));
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
      const contact = createMockQueryBuilder({
        data: { id: 'c1', email: 'a@b.co', do_not_email: false, first_name: 'Robin' },
        error: null,
      });
      mockAdminClient.from.mockReturnValue(contact);
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: async () => '{"message":"domain not verified"}',
        json: async () => ({ message: 'domain not verified' }),
      }) as unknown as typeof fetch;

      const res = await sendCRMDirectEmail({ contactId: 'c1', subject: 'Hi', message: 'There' });

      expect(res.success).toBe(false);
      // The activity row must not claim a delivery that did not happen.
      expect(contact.insert).not.toHaveBeenCalled();
    });

    it('builds the plain-text alternative from the configured site, not a literal', async () => {
      freshAdmin();
      // The HTML link came from `NEXT_PUBLIC_SITE_URL` while the text body
      // hardcoded the apex, so a staging build mailed a link that 302s to a
      // Google Sites page. One source of truth, both places.
      mockEnv.NEXT_PUBLIC_SITE_URL = 'https://staging.indivisiblefairoaks.org';
      const contact = createMockQueryBuilder({
        data: { id: 'c1', email: 'a@b.co', do_not_email: false, first_name: 'Robin' },
        error: null,
      });
      mockAdminClient.from.mockReturnValue(contact);
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
