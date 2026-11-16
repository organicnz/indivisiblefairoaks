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
const verifyIceAlertProof = vi.hoisted(() => vi.fn());
const validatePushEndpoint = vi.hoisted(() => vi.fn());
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
vi.mock('@/lib/ice-alert-proof', () => ({ verifyIceAlertProof }));
vi.mock('@/lib/rate-limit', () => ({
  clientIp: () => '203.0.113.7',
}));
vi.mock('@/lib/push-endpoint', () => ({ validatePushEndpoint }));
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
import {
  hashIceAlertRateLimitKey,
  ICE_ALERT_RATE_LIMITS,
} from '@/lib/ice-alert-rate-limit';

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
  confirm_token_expires_at: string | null;
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

type RateLimitRow = {
  allowed: boolean;
  retry_after_seconds: number;
  limited_scope: 'ip' | 'email' | 'endpoint' | 'global' | null;
};

type FakeStore = {
  rows: SubscriberRow[];
  writes: WriteRecord[];
  lookups: LookupRecord[];
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
  rpcResult: RateLimitRow;
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
    confirm_token_expires_at: '2030-01-01T00:00:00.000Z',
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
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const rpcResult: RateLimitRow = {
    allowed: true,
    retry_after_seconds: 0,
    limited_scope: null,
  };

  const client = {
    async rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      return { data: [rpcResult], error: null };
    },
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

  return { rows, writes, lookups, rpcCalls, rpcResult, client };
}

function request(body: Record<string, unknown>, includeProof = true) {
  return new Request('https://site.test/api/ice-rapid/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(
      includeProof
        ? { proof: { token: 'test-proof-token', nonce: '1' }, ...body }
        : body
    ),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyIceAlertProof.mockResolvedValue(true);
  validatePushEndpoint.mockResolvedValue(undefined);
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

    // The active preferences are untouched. The lookup is exact and normalized,
    // not a pattern match that an alternate address could use to reach this row.
    expect(store.writes).toHaveLength(2);
    expect(store.writes.map((write) => write.payload)).toContainEqual(
      expect.objectContaining({
        confirm_token: expect.any(String),
        confirm_token_expires_at: expect.any(String),
      })
    );
    expect(store.writes.map((write) => write.payload)).not.toContainEqual(
      expect.objectContaining({ state_code: 'TX', city: 'Austin' })
    );
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
    const rotated = store.writes.find(
      (write) => 'confirm_token' in write.payload
    )?.payload.confirm_token;
    expect(claims).toMatchObject({
      subscriberId: '11111111-1111-4111-8111-111111111111',
      confirmToken: rotated,
      stateCode: 'TX',
      city: 'Austin',
    });

    expect(store.rpcCalls).toHaveLength(1);
    expect(store.rpcCalls[0]).toMatchObject({
      fn: 'ice_alert_consume_rate_limits',
      args: {
        p_ip_hash: await hashIceAlertRateLimitKey('ip', '203.0.113.7'),
        p_email_hash: await hashIceAlertRateLimitKey('email', 'robin@example.com'),
        p_endpoint_hash: null,
        p_window_seconds: 600,
        p_ip_limit: ICE_ALERT_RATE_LIMITS.ip,
        p_email_limit: ICE_ALERT_RATE_LIMITS.email,
        p_endpoint_limit: ICE_ALERT_RATE_LIMITS.endpoint,
        p_global_limit: ICE_ALERT_RATE_LIMITS.global,
      },
    });
  });

  it('requires a proof before touching the durable counters', async () => {
    const store = fakeStore([baseRow()]);
    storeRef.current = store.client;

    const response = await POST(
      request({ email: 'robin@example.com' }, false)
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'proof-required' });
    expect(verifyIceAlertProof).not.toHaveBeenCalled();
    expect(store.rpcCalls).toEqual([]);
  });

  it('rejects an invalid proof before touching the durable counters', async () => {
    verifyIceAlertProof.mockResolvedValue(false);
    const store = fakeStore([baseRow()]);
    storeRef.current = store.client;

    const response = await POST(
      request({ email: 'robin@example.com' })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'proof-invalid' });
    expect(store.rpcCalls).toEqual([]);
  });

  it('returns 429 and Retry-After when a durable counter is exhausted', async () => {
    const store = fakeStore([baseRow()]);
    store.rpcResult.allowed = false;
    store.rpcResult.retry_after_seconds = 42;
    store.rpcResult.limited_scope = 'email';
    storeRef.current = store.client;

    const response = await POST(
      request({ email: 'robin@example.com', stateCode: 'CA' })
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('42');
    expect(await response.json()).toMatchObject({ code: 'rate-limited' });
    expect(sendIceAlertConfirmation).not.toHaveBeenCalled();
    expect(store.writes).toEqual([]);
  });

  it('rejects an oversized body while reading it, without consulting storage', async () => {
    const store = fakeStore();
    storeRef.current = store.client;
    const response = await POST(
      new Request('https://site.test/api/ice-rapid/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'robin@example.com',
          proof: { token: 'test-proof-token', nonce: '1' },
          padding: 'x'.repeat(13_000),
        }),
      })
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: 'too-large' });
    expect(store.rpcCalls).toEqual([]);
  });

  it('rejects an invalid push endpoint before reading or writing the subscriber', async () => {
    const store = fakeStore([baseRow()]);
    storeRef.current = store.client;
    // Use the real policy helper for a literal private endpoint; this keeps
    // the route's ordering guarantee pinned to the actual rejection path.
    const actual = await vi.importActual<typeof import('@/lib/push-endpoint')>(
      '@/lib/push-endpoint'
    );
    validatePushEndpoint.mockImplementationOnce(actual.validatePushEndpoint);

    const response = await POST(
      request({
        email: 'robin@example.com',
        pushSubscription: {
          endpoint: 'https://127.0.0.1/push',
          keys: { p256dh: 'p'.repeat(24), auth: 'a'.repeat(12) },
        },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'invalid-push-endpoint' });
    expect(validatePushEndpoint).toHaveBeenCalledWith('https://127.0.0.1/push');
    expect(store.lookups).toEqual([]);
    expect(store.writes).toEqual([]);
    expect(sendIceAlertConfirmation).not.toHaveBeenCalled();
  });

  it('keys the endpoint counter by the push endpoint host', async () => {
    const store = fakeStore();
    storeRef.current = store.client;

    const response = await POST(
      request({
        email: 'robin@example.com',
        pushSubscription: {
          endpoint: 'https://push.example.com/send/abc',
          keys: { p256dh: 'p'.repeat(24), auth: 'a'.repeat(12) },
        },
      })
    );

    expect(response.status).toBe(200);
    expect(store.rpcCalls[0]?.args.p_endpoint_hash).toBe(
      await hashIceAlertRateLimitKey('endpoint', 'push.example.com')
    );
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
    expect(store.writes).toHaveLength(2);
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
      // New rows insert plus stamp the send; existing rows rotate the token and
      // stamp the send. Neither path changes the requested preferences here.
      expect(store.writes, state.name).toHaveLength(2);
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
