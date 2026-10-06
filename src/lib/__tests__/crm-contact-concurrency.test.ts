import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));
vi.mock('server-only', () => ({}));

const mockAdminClient = { from: vi.fn(), rpc: vi.fn() };
const session = vi.hoisted(() => ({ adminUserId: 'admin-user-uuid-1234' }));

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: vi.fn(async () => ({
    adminClient: mockAdminClient,
    get adminUserId() {
      return session.adminUserId;
    },
    get adminEmail() {
      return 'organizer@indivisiblefairoaks.org';
    },
  })),
}));

import { saveCRMContact } from '@/lib/actions/crm';
import { env } from '@/lib/env';
import type { MockTableConfig } from './supabase-mock';
import { createMockAdminClient, touchUpdatedAt } from './supabase-mock';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return { ...actual, env: { ...actual.env } };
});

/**
 * The contact editor's optimistic-concurrency guard.
 *
 * `saveContent` had this for CMS pages and the CRM did not: the read-then-update
 * here was last-write-wins with no signal, so two organizers editing one contact
 * both read, both wrote, and the second silently discarded the first's changes.
 * That is the default outcome of the one surface whose purpose is to look after
 * other people's data.
 *
 * The three properties below each fail silently without their own test, and all
 * three are documented in `AGENTS.md` for `saveContent`. This file is the CRM's
 * copy of that record.
 */
let tables: Record<string, MockTableConfig>;

const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-01-01T00:00:01.000Z';

/** `contactSchema` validates `id` as a UUID, so the fixtures use real ones. */
const CONTACT_ID = '11111111-2222-4333-8444-555555555555';

const baseRow = (over: Record<string, unknown> = {}) => ({
  id: CONTACT_ID,
  email: 'alice@example.com',
  first_name: 'Alice',
  last_name: null,
  phone: null,
  address: null,
  city: null,
  zip_code: null,
  district: 'CA-06',
  status: 'supporter',
  tags: ['choir'],
  notes: null,
  updated_at: T0,
  ...over,
});

/**
 * A minimal valid *edit* payload: `id` present, so this takes the update path,
 * plus the version the editor was opened at.
 */
const edit = (over: Record<string, unknown> = {}) => ({
  id: CONTACT_ID,
  email: 'alice@example.com',
  status: 'supporter' as const,
  district: 'CA-06',
  tags: ['choir'],
  updated_at: T0,
  ...over,
});

/** The same payload with no `id`, so `saveCRMContact` takes the insert path. */
function createNew(over: Record<string, unknown> = {}) {
  const { id: _omit, ...rest } = edit(over);
  return rest;
}

describe('saveCRMContact: the insert path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminClient.from.mockReset();
    mockAdminClient.rpc.mockReset();
    tables = {
      crm_contacts: {
        rows: [],
        insert: { id: CONTACT_ID },
        onInsert: (row) => {
          row.id = CONTACT_ID;
        },
      },
      crm_activities: { rows: [] },
    };
    mockAdminClient.from.mockImplementation(createMockAdminClient(tables).from);
  });

  /**
   * The insert path must not carry the version precondition: there is no row to
   * be stale against, and a null claim there would be asking "is this row's
   * `updated_at` null" about a row that does not exist yet.
   */
  it('creates without sending a version precondition', async () => {
    const res = await saveCRMContact(createNew({ notes: 'met at the rally' }));

    expect(res.success).toBe(true);
    expect(res.contactId).toBe(CONTACT_ID);
    // "created", not "updated" — a new constituent's timeline opens with the
    // right entry.
    expect(tables.crm_activities.rows?.at(-1)).toMatchObject({
      type: 'note',
      title: 'Constituent Created',
    });
  });

  it('rejects an oversized notes blob on create as well as on update', async () => {
    const res = await saveCRMContact(createNew({ notes: 'x'.repeat(5001) }));

    expect(res.success).toBe(false);
    expect(tables.crm_contacts.rows).toHaveLength(0);
  });
});

describe('saveCRMContact: optimistic concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminClient.from.mockReset();
    mockAdminClient.rpc.mockReset();
    (env as unknown as Record<string, unknown>).SUPABASE_SECRET_KEY = 'dummy';
    tables = {
      crm_contacts: { rows: [baseRow()], onUpdate: touchUpdatedAt() },
      crm_activities: { rows: [] },
    };
    mockAdminClient.from.mockImplementation(createMockAdminClient(tables).from);
  });

  it('accepts a save whose version still matches', async () => {
    const res = await saveCRMContact(edit({ city: 'Carmichael' }));

    expect(res.success).toBe(true);
    expect(tables.crm_contacts.rows?.[0]?.city).toBe('Carmichael');
    // The new version comes from the trigger, not from a clock in this process.
    // A second clock disagrees by milliseconds, and then the editor's *next* save
    // conflicts with itself — a false positive that teaches people to ignore the
    // message.
    expect(res.updatedAt).toBe(T1);
    expect(res.updatedAt).not.toBe(T0);
  });

  /**
   * The failure this exists to prevent: a colleague saved first, and the second
   * save would otherwise overwrite their work with a stale copy of the form.
   */
  it('refuses a save whose version is stale', async () => {
    // The colleague's save moved the row on.
    const row = tables.crm_contacts.rows?.[0] as Record<string, unknown>;
    row.updated_at = T1;

    const res = await saveCRMContact(edit({ city: 'Carmichael', updated_at: T0 }));

    expect(res.success).toBe(false);
    expect(res.reason).toBe('conflict');
    // Reported as a conflict rather than a generic failure, because "reload and
    // re-apply" and "the database is down" are different advice.
    expect(res.error).toMatch(/someone else saved/i);
    // And nothing was written: the stale editor's city never lands.
    expect(tables.crm_contacts.rows?.[0]?.city).toBeNull();
  });

  it('keeps the colleague’s values, not the stale form’s', async () => {
    const row = tables.crm_contacts.rows?.[0] as Record<string, unknown>;
    row.updated_at = T1;
    row.city = 'Fair Oaks';

    await saveCRMContact(edit({ city: 'Carmichael', notes: 'stale note', updated_at: T0 }));

    const survivor = tables.crm_contacts.rows?.[0];
    expect(survivor?.city).toBe('Fair Oaks');
    expect(survivor?.notes).toBeNull();
  });

  /**
   * `updated_at` must never be written from the form. It is the *expected*
   * version; writing it back would overwrite the value the trigger is about to
   * write with the stale one, so the editor's next save would conflict with
   * itself.
   */
  it('never writes the claimed version back as a value', async () => {
    await saveCRMContact(edit({ city: 'Carmichael', updated_at: T0 }));

    // The row carries the trigger's T1, not the T0 the form sent.
    expect(tables.crm_contacts.rows?.[0]?.updated_at).toBe(T1);
  });

  /**
   * A null claim uses `.is()`, never `.eq()`. `.eq('updated_at', null)` becomes
   * `col=eq.null` in PostgREST and matches nothing, so the guard would fire
   * against every row that had never been updated — refusing every save on the
   * basis of a column value rather than a version.
   */
  it('uses an is() precondition, not eq(), when the claim is null', async () => {
    const row = baseRow({ updated_at: null });

    const calls: { method: string; args: unknown[] }[] = [];
    const inner = createMockAdminClient({
      crm_contacts: { rows: [row] },
      crm_activities: { rows: [] },
    });
    const builder = inner.from('crm_contacts');
    // Record every filter method the action reaches for, then hand it straight
    // through. `apply` rather than a rest-args spread: the methods have
    // distinct tuple signatures, and `(...args as never[])` on a union of them
    // is a cast that hides the very mismatch it would catch.
    const record =
      <A extends unknown[]>(method: string, original: (...args: A) => unknown) =>
      (...args: A): unknown => {
        calls.push({ method, args });
        return original(...args);
      };
    const eq = builder.eq.bind(builder) as unknown as (...args: [string, unknown]) => unknown;
    const is = builder.is.bind(builder) as unknown as (...args: [string, unknown]) => unknown;
    builder.eq = record('eq', eq) as typeof builder.eq;
    builder.is = record('is', is) as typeof builder.is;

    mockAdminClient.from.mockImplementation((table: string) =>
      table === 'crm_contacts' ? builder : inner.from(table)
    );

    const res = await saveCRMContact(edit({ updated_at: null }));

    // A null claim matches a null row — `.is()` — and the save succeeds.
    expect(res.success).toBe(true);
    expect(calls.some((c) => c.method === 'is' && c.args[0] === 'updated_at')).toBe(true);
    // The failure mode: `eq('updated_at', null)` would have matched nothing, so
    // every save from a never-edited row would report a conflict.
    expect(calls.some((c) => c.method === 'eq' && c.args[0] === 'updated_at')).toBe(false);
  });

  /**
   * The version field is optional in the schema, and a caller that omits it gets
   * `.is('updated_at', null)` — which matches only a row that has never been
   * updated. On an already-touched row that is a conflict, and that is correct
   * rather than a bug: a caller with no idea what version it is editing should
   * not be allowed to overwrite one it cannot see.
   */
  it('refuses a no-version save against an already-updated row', async () => {
    const { updated_at: _omitted, ...noVersion } = edit({ city: 'Carmichael' });

    const res = await saveCRMContact(noVersion);

    expect(res.success).toBe(false);
    expect(res.reason).toBe('conflict');
    // Still the original null city — the refused save changed nothing.
    expect(tables.crm_contacts.rows?.[0]?.city).toBeNull();
  });

  it('accepts a no-version save against a never-updated row', async () => {
    tables.crm_contacts = { rows: [baseRow({ updated_at: null })], onUpdate: touchUpdatedAt() };
    const { updated_at: _omitted, ...noVersion } = edit({ city: 'Carmichael' });

    const res = await saveCRMContact(noVersion);

    expect(res.success).toBe(true);
    expect(tables.crm_contacts.rows?.[0]?.city).toBe('Carmichael');
  });
});

describe('saveCRMContact: failure paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminClient.from.mockReset();
    mockAdminClient.rpc.mockReset();
    tables = {
      crm_contacts: { rows: [baseRow()], onUpdate: touchUpdatedAt() },
      crm_activities: { rows: [] },
    };
    mockAdminClient.from.mockImplementation(createMockAdminClient(tables).from);
  });

  it('reports a vanished contact as a sentence, not a TypeError', async () => {
    tables.crm_contacts = { rows: [], onUpdate: touchUpdatedAt() };

    const res = await saveCRMContact(edit());

    // The read's error used to be discarded, so the code went on to UPDATE a row
    // that matched nothing, got `data: null` back, and threw on `updated.id` —
    // a 500 and an error boundary rather than a sentence.
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/no longer exists/i);
    expect(res.reason).toBeUndefined();
  });

  it('records a status change on the timeline, naming both values', async () => {
    await saveCRMContact(edit({ status: 'donor' }));

    expect(tables.crm_activities.rows?.at(-1)).toMatchObject({
      type: 'status_change',
      title: 'Status Changed',
      metadata: { from: 'supporter', to: 'donor' },
    });
  });

  it('records a plain edit without calling it a status change', async () => {
    await saveCRMContact(edit({ city: 'Fair Oaks' }));

    // The status is unchanged, so "Status Changed" would be a lie on a
    // constituent's permanent record.
    expect(tables.crm_activities.rows?.at(-1)).toMatchObject({
      type: 'status_change',
      title: 'Constituent Profile Updated',
    });
  });

  it('lets a second save succeed against the version the first returned', async () => {
    // The editor's own workflow: save, adopt the returned version, save again.
    // If the response carried the *claimed* version rather than the trigger's,
    // this second save would conflict with itself.
    const first = await saveCRMContact(edit({ status: 'donor' }));
    expect(first.success).toBe(true);

    // `status` is carried forward explicitly, which is what the editor does — it
    // submits the whole form, not a patch. (`contactSchema` applies
    // `.default('supporter')`, so a caller that *omitted* it would reset the
    // status; that is a property of the schema, not of this test.)
    const second = await saveCRMContact(
      edit({ city: 'Fair Oaks', status: 'donor', updated_at: first.updatedAt })
    );

    expect(second.success).toBe(true);
    expect(tables.crm_contacts.rows?.[0]?.city).toBe('Fair Oaks');
    expect(tables.crm_contacts.rows?.[0]?.status).toBe('donor');
  });
});

describe('saveCRMContact: notes budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminClient.from.mockReset();
    mockAdminClient.rpc.mockReset();
    tables = {
      crm_contacts: { rows: [baseRow()], onUpdate: touchUpdatedAt() },
      crm_activities: { rows: [] },
    };
    mockAdminClient.from.mockImplementation(createMockAdminClient(tables).from);
  });

  /**
   * An arbitrarily large notes blob used to be accepted from three directions at
   * once — this schema, the CSV importer, and an editor textarea with no
   * `maxLength` — and it is rendered in the 360 panel *and* emitted in every
   * directory CSV export. The cap matches the importer's per-row budget, so an
   * exported contact can be re-imported.
   */
  it('rejects notes past the budget rather than storing them', async () => {
    const res = await saveCRMContact(edit({ notes: 'x'.repeat(5001) }));

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/too big|too long|5000|maximum/i);
    expect(tables.crm_contacts.rows?.[0]?.notes).toBeNull();
  });

  it('accepts notes at exactly the budget', async () => {
    const res = await saveCRMContact(edit({ notes: 'x'.repeat(5000) }));

    expect(res.success).toBe(true);
    expect(tables.crm_contacts.rows?.[0]?.notes).toHaveLength(5000);
  });
});
