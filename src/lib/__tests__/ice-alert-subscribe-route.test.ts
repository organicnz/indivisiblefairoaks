// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Subscriber authorization is the boundary between "someone typed this email
 * address" and "the person who controls it asked for this change". These tests
 * keep that boundary observable from the route, rather than only from helper
 * unit tests.
 */

const TEST_SECRET = vi.hoisted(() => 'test-ice-alert-management-secret');
const ACCEPTED = {
  ok: true,
  status: 'pending',
  message: 'Check your inbox to confirm your surge-alert preferences.',
};

const sendIceAlertConfirmation = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());
const storeRef = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SECRET_KEY: TEST_SECRET,
    NEXT_PUBLIC_SITE_URL: 'https://site.test',
    RESEND_FROM_EMAIL: 'contact@indivisiblefairoaks.org',
  },
}));

vi.mock('@/lib/e2e-mode', () => ({ isE2EMode: () => false }));
vi.mock('@/lib/ice-alert-email', () => ({ sendIceAlertConfirmation }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit,
  clientKey: () => 'test-ip',
}));
vi.mock('@/lib/push-endpoint', () => ({
  validatePushEndpoint: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/rapid-city-match', () => ({
  US_STATE_CODES: new Set(['CA', 'TX', 'NY']),
}));
vi.mock('@/lib/ice-alert-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ice-alert-store')>();
  return {
    ...actual,
    getIceAlertStore: () =>
      storeRef.current as ReturnType<typeof actual.getIceAlertStore>,
  };
});

import { POST } from '@/app/api/ice-rapid/subscribe/route';
import { verifyIceAlertManagementToken } from '@/lib/ice-alert-management';

type SubscriberRow = {
  id: string;
  email: string;
  email_normalized: string;
  state_code: string | null;
  city: string | null;
  email_opt_in: boolean;
  push_opt_in: boolean;
  push_subscription: null;
  confirm_token: string;
  unsubscribe_token: string;
  confirmed_at: string | null;
  confirmation_sent_at: string | null;
  last_notified_at: string | null;
  last_surge_key: string | null;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
};

type WriteRecord =
  | { op: 'insert'; payload: Record<string, unknown> }
  | { op: 'update'; payload: Record<string, unknown> };

type LookupRecord = {
  table: string;
  column: string;
  value: unknown;
};

type FakeStore = {
  rows: SubscriberRow[];
  writes: WriteRecord[];
  lookups: LookupRecord[];
  client: unknown;
};

function baseRow(overrides: Partial<SubscriberRow> = {}): SubscriberRow {
  const row = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'Robin@Example.com',
    email_normalized: 'robin@example.com',
    state_code: 'CA',
    city: 'Oakland',
    email_opt_in: true,
    push_opt_in: false,
    push_subscription: null,
    confirm_token: '22222222-2222-4222-8222-222222222222',
    unsubscribe_token: '33333333-3333-4333-8333-333333333333',
    confirmed_at: '2026-11-01T00:00:00.000Z',
    confirmation_sent_at: null,
    last_notified_at: null,
    last_surge_key: null,
    unsubscribed_at: null,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
  row.email_normalized = row.email.trim().toLowerCase();
  return row;
}

function fakeStore(initialRows: SubscriberRow[] = []): FakeStore {
  const rows = initialRows.map((row) => ({ ...row }));
  const writes: WriteRecord[] = [];
  const lookups: LookupRecord[] = [];

  const client = {
    from(table: string) {
      let operation: 'select' | 'insert' | 'update' = 'select';
      let insertPayload: Record<string, unknown> | null = null;
      let updatePayload: Record<string, unknown> | null = null;
      let filterColumn = '';
      let filterValue: unknown;

      const api = {
        select() {
          return api;
        },
        insert(payload: Record<string, unknown>) {
          operation = 'insert';
          insertPayload = payload;
          return api;
        },
        update(payload: Record<string, unknown>) {
          operation = 'update';
          updatePayload = payload;
          return api;
        },
        eq(column: string, value: unknown) {
          filterColumn = column;
          filterValue = value;
          return api;
        },
        async maybeSingle() {
          lookups.push({ table, column: filterColumn, value: filterValue });
          return {
            data:
              rows.find(
                (row) =>
                  (row as Record<string, unknown>)[filterColumn] === filterValue
              ) ?? null,
            error: null,
          };
        },
        async single() {
          if (operation === 'insert' && insertPayload) {
            const email = String(insertPayload.email);
            rows.push({
              ...baseRow(),
              ...insertPayload,
              id: crypto.randomUUID(),
              email,
              email_normalized: email.trim().toLowerCase(),
            } as SubscriberRow);
            writes.push({ op: 'insert', payload: insertPayload });
            return { data: rows.at(-1), error: null };
          }

          if (operation === 'update' && updatePayload) {
            const index = rows.findIndex(
              (row) => row.id === filterValue
            );
            if (index < 0) return { data: null, error: null };
            rows[index] = {
              ...rows[index],
              ...updatePayload,
              updated_at: new Date().toISOString(),
            };
            writes.push({ op: 'update', payload: updatePayload });
            return { data: rows[index], error: null };
          }

          return { data: null, error: null };
        },
      };

      return api;
    },
  };

  return { rows, writes, lookups, client };
}

function request(body: Record<string, unknown>) {
  return new Request('https://site.test/api/ice-rapid/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockReturnValue({ ok: true, retryAfterSec: 0 });
  sendIceAlertConfirmation.mockResolvedValue({ ok: true, id: 'email-1' });
});

describe('POST /api/ice-rapid/subscribe authorization', () => {
  it('does not update a confirmed subscriber from an email-only request', async () => {
    const store = fakeStore([baseRow()]);
    storeRef.current = store.client;

    const response = await POST(
      request({
        email: '  Robin@Example.COM ',
        stateCode: 'TX',
        city: 'Austin',
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(ACCEPTED);

    // The active row is untouched. The lookup is exact and normalized, not a
    // pattern match that an alternate address could use to reach this row.
    expect(store.writes).toEqual([]);
    expect(store.lookups).toContainEqual({
      table: 'ice_alert_subscribers',
      column: 'email_normalized',
      value: 'robin@example.com',
    });
    expect(store.rows[0]).toMatchObject({
      state_code: 'CA',
      city: 'Oakland',
      confirmed_at: '2026-11-01T00:00:00.000Z',
    });

    const sent = sendIceAlertConfirmation.mock.calls[0]?.[0] as {
      email: string;
      token: string;
      unsubscribeToken: string;
      intent: string;
      stateCode: string;
      city: string;
    };
    expect(sent).toMatchObject({
      email: 'Robin@Example.com',
      unsubscribeToken: '33333333-3333-4333-8333-333333333333',
      intent: 'manage',
      stateCode: 'TX',
      city: 'Austin',
    });
    expect(sent.token).not.toMatch(/^[0-9a-f-]{36}$/i);

    const claims = await verifyIceAlertManagementToken(sent.token, {
      secret: TEST_SECRET,
    });
    expect(claims).toMatchObject({
      subscriberId: '11111111-1111-4111-8111-111111111111',
      stateCode: 'TX',
      city: 'Austin',
    });
  });

  it('preserves an existing area when the request omits a new one', async () => {
    const store = fakeStore([baseRow()]);
    storeRef.current = store.client;

    const response = await POST(request({ email: 'robin@example.com' }));

    expect(response.status).toBe(200);
    const sent = sendIceAlertConfirmation.mock.calls[0]?.[0] as {
      token: string;
      stateCode: string;
      city: string;
    };
    const claims = await verifyIceAlertManagementToken(sent.token, {
      secret: TEST_SECRET,
    });
    expect(claims).toMatchObject({ stateCode: 'CA', city: 'Oakland' });
    expect(sent).toMatchObject({ stateCode: 'CA', city: 'Oakland' });
    expect(store.writes).toEqual([]);
  });

  it('returns the same accepted response for new, pending, confirmed, and unsubscribed addresses', async () => {
    const cases: { name: string; rows: SubscriberRow[] }[] = [
      { name: 'new', rows: [] },
      { name: 'pending', rows: [baseRow({ confirmed_at: null })] },
      { name: 'confirmed', rows: [baseRow()] },
      {
        name: 'unsubscribed',
        rows: [
          baseRow({
            email_opt_in: false,
            confirmed_at: null,
            unsubscribed_at: '2026-11-02T00:00:00.000Z',
          }),
        ],
      },
    ];

    for (const state of cases) {
      const store = fakeStore(state.rows);
      storeRef.current = store.client;

      const response = await POST(
        request({ email: 'Robin@Example.com', stateCode: 'CA' })
      );

      expect(response.status, state.name).toBe(200);
      expect(await response.json(), state.name).toEqual(ACCEPTED);
      if (state.rows.length > 0) {
        expect(store.writes, state.name).toEqual([]);
      }
    }
  });

  it('treats a different address as a new subscriber instead of matching the existing one', async () => {
    const store = fakeStore([baseRow()]);
    storeRef.current = store.client;

    const response = await POST(
      request({ email: 'victim+alias@example.com', stateCode: 'TX' })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(ACCEPTED);
    expect(store.writes).toHaveLength(2); // insert + confirmation_sent_at
    expect(store.writes[0]).toMatchObject({
      op: 'insert',
      payload: { email: 'victim+alias@example.com' },
    });
    expect(store.rows).toHaveLength(2);
    expect(store.rows[0]).toMatchObject({ state_code: 'CA', city: 'Oakland' });

    const sent = sendIceAlertConfirmation.mock.calls[0]?.[0] as {
      email: string;
      token: string;
      intent?: string;
    };
    expect(sent.email).toBe('victim+alias@example.com');
    expect(sent.token).toMatch(/^[0-9a-f-]{36}$/i);
    expect(sent.intent).toBeUndefined();
  });

  it('does not reveal account state through an email delivery failure', async () => {
    sendIceAlertConfirmation.mockResolvedValue({
      ok: false,
      error: 'transport:Error',
      status: 0,
    });

    const responses: { status: number; body: unknown }[] = [];
    for (const rows of [[], [baseRow()]]) {
      const store = fakeStore(rows);
      storeRef.current = store.client;
      const response = await POST(
        request({ email: 'robin@example.com', stateCode: 'CA' })
      );
      responses.push({ status: response.status, body: await response.json() });
    }

    expect(responses[0].status).toBe(502);
    expect(responses[1]).toEqual(responses[0]);
    expect(responses[0].body).toMatchObject({ code: 'email-failed' });
  });

  it('does not resend to an address during the confirmation cooldown', async () => {
    const store = fakeStore([
      baseRow({ confirmation_sent_at: new Date().toISOString() }),
    ]);
    storeRef.current = store.client;

    const response = await POST(
      request({ email: 'robin@example.com', stateCode: 'TX' })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(ACCEPTED);
    expect(store.writes).toEqual([]);
    expect(sendIceAlertConfirmation).not.toHaveBeenCalled();
  });
});
