// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeBase64, encodeBase64 } from '@/lib/base64';

/**
 * Resend delivery-event webhook handler.
 *
 * ## What this tests
 *
 * 1. A valid HMAC-SHA256 signature is accepted and the event is processed.
 * 2. An invalid signature is rejected with 400 — no writes.
 * 3. A missing RESEND_WEBHOOK_SECRET env var returns 400.
 * 4. A stale svix-timestamp is rejected with 400 — no writes (replay protection).
 * 5. `email.complained` sets do_not_email = true, same as a hard bounce.
 * 6. `email.opened` does NOT change do_not_email — it is engagement data only.
 * 7. An unknown recipient email returns 200 with no writes (Resend must not
 *    retry on addresses that simply aren't in our CRM).
 * 8. Tri-state: a `NULL` (never asked) contact is suppressed — the bounce is
 *    the answer to the question nobody asked before.
 * 9. Suppression stamps `unsubscribed_at` and preserves the earliest evidence.
 * 10. The contact lookup lowercases the recipient — CRM emails are stored
 *     lowercase, so an exact-case match would miss mixed-case rows.
 *
 * ## Signature construction in tests
 *
 * The route verifies HMAC-SHA256 of `${svix-id}.${svix-timestamp}.${rawBody}`
 * using `crypto.subtle`. Tests build valid signatures the same way, so the
 * crypto path is exercised end-to-end rather than mocked out. Timestamps are
 * fresh per request: the route rejects anything older than five minutes.
 */

const createAdminClient = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase-server', () => ({ createAdminClient }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit,
  clientKey: () => 'test-ip',
}));

// `src/lib/env.ts` Zod-parses `process.env` once at import time, so the secret
// has to be stubbed *before* the route module is evaluated — the same pattern
// as `site-config.test.ts`. Each load re-imports through the stubbed env.
async function loadRoute(secret: string) {
  vi.resetModules();
  vi.stubEnv('RESEND_WEBHOOK_SECRET', secret);
  return await import('@/app/api/webhooks/resend/route');
}

// A real-format secret. Signatures below are built the way Svix builds them —
// HMAC keyed by the base64-decoded part after `whsec_` — so the route is tested
// against the production key derivation, not a self-consistent variant of it.
const TEST_SECRET = `whsec_${encodeBase64(new TextEncoder().encode('test-webhook-secret-bytes'))}`;
const SVIX_ID = 'msg_01jx000000000000000000000';

/** Fresh seconds-since-epoch timestamp, as Svix sends it. */
function freshTimestamp(): string {
  return String(Math.floor(Date.now() / 1000));
}

/** Compute the valid HMAC-SHA256 signature for a given body + timestamp. */
async function sign(body: string, timestamp: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    // `Uint8Array<ArrayBuffer>` rather than `Uint8Array`: `importKey` takes a
    // `BufferSource`, and the widened type is not one — it could be backed by
    // a `SharedArrayBuffer`.
    decodeBase64(TEST_SECRET.slice('whsec_'.length)) as Uint8Array<ArrayBuffer>,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signedContent = `${SVIX_ID}.${timestamp}.${body}`;
  const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(signedContent));
  const b64 = encodeBase64(new Uint8Array(sigBuf));
  return `v1,${b64}`;
}

/** Build a signed POST request for the webhook endpoint. */
async function signedRequest(
  body: object,
  overrides?: { signature?: string; secret?: string; timestamp?: string }
): Promise<Request> {
  const rawBody = JSON.stringify(body);
  const timestamp = overrides?.timestamp ?? freshTimestamp();
  const sig = overrides?.signature ?? (await sign(rawBody, timestamp));
  return new Request('https://site.test/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'svix-id': SVIX_ID,
      'svix-timestamp': timestamp,
      'svix-signature': sig,
    },
    body: rawBody,
  });
}

/** Records every write operation so tests can assert on side-effects. */
let writes: { table: string; op: 'update' | 'insert'; payload: unknown }[];
/** Records the arguments of `.eq()` calls so tests can assert on filters. */
let eqCalls: { column: string; value: unknown }[];

type ContactRow = {
  id: string;
  email: string;
  do_not_email: boolean | null;
  unsubscribed_at?: string | null;
};

/**
 * Inline fake PostgREST builder matching the shapes the route uses.
 *
 * `contacts` is one row (matched for any email) or a map by email. Each entry
 * in `eventInsertErrors` is consumed by one `crm_email_events` insert, which
 * is how a test reproduces a duplicate-key retry (23505) or a missing campaign
 * (23503).
 */
function fakeClient(
  contacts: ContactRow | null | Record<string, ContactRow>,
  eventInsertErrors: Array<{ code: string } | null> = []
) {
  const errors = [...eventInsertErrors];
  return () => ({
    from(table: string) {
      let emailFilter: unknown;
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          eqCalls.push({ column, value });
          if (column === 'email') emailFilter = value;
          return chain;
        },
        maybeSingle: async () => {
          if (contacts === null || 'id' in contacts) return { data: contacts, error: null };
          return {
            data: (contacts as Record<string, ContactRow>)[String(emailFilter)] ?? null,
            error: null,
          };
        },
        update: (payload: unknown) => {
          writes.push({ table, op: 'update', payload });
          return { eq: async () => ({ error: null }) };
        },
        insert: (payload: unknown) => {
          const error = table === 'crm_email_events' ? (errors.shift() ?? null) : null;
          if (!error) writes.push({ table, op: 'insert', payload });
          return Promise.resolve({ error });
        },
      };
      return chain;
    },
  });
}

const BOUNCE_EVENT = {
  type: 'email.bounced',
  created_at: '2026-10-06T12:00:00.000Z',
  data: {
    to: ['member@example.com'],
    email_id: 'res_abc123',
    bounce: { type: 'Permanent', subType: 'General' },
  },
};

const TEMPORARY_BOUNCE_EVENT = {
  type: 'email.bounced',
  data: {
    to: ['member@example.com'],
    email_id: 'res_tmp',
    bounce: { type: 'Temporary', subType: 'MailboxFull' },
  },
};

const SUPPRESSED_EVENT = {
  type: 'email.suppressed',
  data: { to: ['member@example.com'], email_id: 'res_sup' },
};

const CAMPAIGN_ID = '8b146471-e88e-4322-86af-016cd36fd216';

const COMPLAINED_EVENT = {
  type: 'email.complained',
  data: {
    to: ['member@example.com'],
    email_id: 'res_def456',
  },
};

const OPENED_EVENT = {
  type: 'email.opened',
  data: {
    to: ['member@example.com'],
    email_id: 'res_ghi789',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  writes = [];
  eqCalls = [];
  rateLimit.mockReturnValue({ ok: true, retryAfterSec: 0 });
  createAdminClient.mockImplementation(
    fakeClient({ id: 'c-1', email: 'member@example.com', do_not_email: false })
  );
});

async function POST(req: Request) {
  const { POST: handler } = await loadRoute(TEST_SECRET);
  return handler(req);
}

describe('POST /api/webhooks/resend — signature verification', () => {
  it('accepts a valid HMAC signature and processes the event', async () => {
    const res = await POST(await signedRequest(BOUNCE_EVENT));

    expect(res.status).toBe(200);
    // The event must have been written.
    expect(writes.some((w) => w.table === 'crm_email_events' && w.op === 'insert')).toBe(true);
  });

  it('rejects an invalid signature with 400 and writes nothing', async () => {
    const res = await POST(
      await signedRequest(BOUNCE_EVENT, { signature: 'v1,aW52YWxpZHNpZ25hdHVyZQ==' })
    );

    expect(res.status).toBe(400);
    expect(writes).toEqual([]);
  });

  it('rejects a request when RESEND_WEBHOOK_SECRET is absent', async () => {
    const { POST: handler } = await loadRoute('');

    const res = await handler(await signedRequest(BOUNCE_EVENT));

    expect(res.status).toBe(400);
    expect(writes).toEqual([]);
  });

  it('rejects a stale timestamp with 400 and writes nothing', async () => {
    const stale = String(Math.floor(Date.now() / 1000) - 60 * 60);
    const rawBody = JSON.stringify(BOUNCE_EVENT);
    const sig = await sign(rawBody, stale);

    const res = await POST(await signedRequest(BOUNCE_EVENT, { signature: sig, timestamp: stale }));

    expect(res.status).toBe(400);
    expect(writes).toEqual([]);
  });
});

describe('POST /api/webhooks/resend — email.bounced', () => {
  it('sets do_not_email = true on the matching contact', async () => {
    await POST(await signedRequest(BOUNCE_EVENT));

    const update = writes.find((w) => w.table === 'crm_contacts' && w.op === 'update');
    expect(update).toBeDefined();
    expect(update?.payload).toMatchObject({ do_not_email: true });
  });

  it('stamps unsubscribed_at alongside the suppression', async () => {
    await POST(await signedRequest(BOUNCE_EVENT));

    const update = writes.find((w) => w.table === 'crm_contacts' && w.op === 'update');
    expect(update?.payload).toMatchObject({ do_not_email: true });
    expect(update?.payload).toMatchObject({ unsubscribed_at: expect.any(String) });
  });

  it('preserves the earliest unsubscribed_at rather than overwriting it', async () => {
    const original = '2024-01-15T10:00:00.000Z';
    createAdminClient.mockImplementation(
      fakeClient({
        id: 'c-1',
        email: 'member@example.com',
        do_not_email: false,
        unsubscribed_at: original,
      })
    );

    await POST(await signedRequest(BOUNCE_EVENT));

    const update = writes.find((w) => w.table === 'crm_contacts' && w.op === 'update');
    expect(update?.payload).toMatchObject({ unsubscribed_at: original });
  });

  it('suppresses a never-asked (NULL) contact — the bounce is the answer', async () => {
    createAdminClient.mockImplementation(
      fakeClient({ id: 'c-1', email: 'member@example.com', do_not_email: null })
    );

    await POST(await signedRequest(BOUNCE_EVENT));

    const update = writes.find((w) => w.table === 'crm_contacts' && w.op === 'update');
    expect(update).toBeDefined();
    expect(update?.payload).toMatchObject({ do_not_email: true });
  });

  it('looks the contact up by the lowercased recipient', async () => {
    const mixedCase = {
      type: 'email.bounced',
      data: { to: ['Member@Example.COM'], email_id: 'res_mixed' },
    };
    await POST(await signedRequest(mixedCase));

    const emailFilter = eqCalls.find((c) => c.column === 'email');
    expect(emailFilter?.value).toBe('member@example.com');
  });

  it('inserts a crm_activities row with type email_bounced', async () => {
    await POST(await signedRequest(BOUNCE_EVENT));

    const activity = writes.find((w) => w.table === 'crm_activities' && w.op === 'insert');
    expect(activity).toBeDefined();
    expect(activity?.payload).toMatchObject({ type: 'email_bounced' });
  });

  it('inserts a crm_email_events row with event_type bounced', async () => {
    await POST(await signedRequest(BOUNCE_EVENT));

    const event = writes.find((w) => w.table === 'crm_email_events' && w.op === 'insert');
    expect(event).toBeDefined();
    expect(event?.payload).toMatchObject({ event_type: 'bounced' });
  });

  it('does not write a second suppression if the contact is already suppressed', async () => {
    createAdminClient.mockImplementation(
      fakeClient({ id: 'c-1', email: 'member@example.com', do_not_email: true })
    );

    await POST(await signedRequest(BOUNCE_EVENT));

    // The email event is always recorded, but no contact update or activity.
    expect(writes.some((w) => w.table === 'crm_contacts' && w.op === 'update')).toBe(false);
    expect(writes.some((w) => w.table === 'crm_activities' && w.op === 'insert')).toBe(false);
    expect(writes.some((w) => w.table === 'crm_email_events' && w.op === 'insert')).toBe(true);
  });
});

describe('POST /api/webhooks/resend — email.complained', () => {
  it('sets do_not_email = true on the matching contact', async () => {
    await POST(await signedRequest(COMPLAINED_EVENT));

    const update = writes.find((w) => w.table === 'crm_contacts' && w.op === 'update');
    expect(update).toBeDefined();
    expect(update?.payload).toMatchObject({ do_not_email: true });
  });

  it('inserts a crm_activities row with type email_complained', async () => {
    await POST(await signedRequest(COMPLAINED_EVENT));

    const activity = writes.find((w) => w.table === 'crm_activities' && w.op === 'insert');
    expect(activity).toBeDefined();
    expect(activity?.payload).toMatchObject({ type: 'email_complained' });
  });
});

describe('POST /api/webhooks/resend — email.opened', () => {
  it('inserts a crm_email_events row with event_type opened', async () => {
    await POST(await signedRequest(OPENED_EVENT));

    const event = writes.find((w) => w.table === 'crm_email_events' && w.op === 'insert');
    expect(event).toBeDefined();
    expect(event?.payload).toMatchObject({ event_type: 'opened' });
  });

  it('does NOT change do_not_email', async () => {
    await POST(await signedRequest(OPENED_EVENT));

    const update = writes.find((w) => w.table === 'crm_contacts' && w.op === 'update');
    expect(update).toBeUndefined();
  });

  it('does NOT insert a crm_activities row', async () => {
    await POST(await signedRequest(OPENED_EVENT));

    const activity = writes.find((w) => w.table === 'crm_activities' && w.op === 'insert');
    expect(activity).toBeUndefined();
  });
});

describe('POST /api/webhooks/resend — unknown recipient', () => {
  it('returns 200 and writes nothing when the email is not in the CRM', async () => {
    createAdminClient.mockImplementation(fakeClient(null));

    const res = await POST(await signedRequest(BOUNCE_EVENT));

    expect(res.status).toBe(200);
    expect(writes).toEqual([]);
  });
});

describe('POST /api/webhooks/resend — bounce severity', () => {
  it('records a temporary bounce without suppressing the contact', async () => {
    const res = await POST(await signedRequest(TEMPORARY_BOUNCE_EVENT));

    expect(res.status).toBe(200);
    const event = writes.find((w) => w.table === 'crm_email_events');
    expect(event?.payload).toMatchObject({ event_type: 'bounced' });
    expect(writes.some((w) => w.table === 'crm_contacts' && w.op === 'update')).toBe(false);
    expect(writes.some((w) => w.table === 'crm_activities')).toBe(false);
  });

  it('does not suppress a bounce that carries no bounce type at all', async () => {
    const untyped = { type: 'email.bounced', data: { to: ['member@example.com'] } };
    await POST(await signedRequest(untyped));

    expect(writes.some((w) => w.table === 'crm_contacts' && w.op === 'update')).toBe(false);
  });

  it('records occurred_at from the event, not from receipt', async () => {
    await POST(await signedRequest(BOUNCE_EVENT));

    const event = writes.find((w) => w.table === 'crm_email_events');
    expect(event?.payload).toMatchObject({ occurred_at: '2026-10-06T12:00:00.000Z' });
  });
});

describe('POST /api/webhooks/resend — email.suppressed', () => {
  it('suppresses the contact and logs why', async () => {
    await POST(await signedRequest(SUPPRESSED_EVENT));

    const update = writes.find((w) => w.table === 'crm_contacts' && w.op === 'update');
    expect(update?.payload).toMatchObject({ do_not_email: true });
    const activity = writes.find((w) => w.table === 'crm_activities');
    expect(activity?.payload).toMatchObject({
      type: 'email_bounced',
      title: 'Address Suppressed by Resend',
    });
    const event = writes.find((w) => w.table === 'crm_email_events');
    expect(event?.payload).toMatchObject({ event_type: 'suppressed' });
  });
});

describe('POST /api/webhooks/resend — retries', () => {
  it('stores the svix-id on the event row', async () => {
    await POST(await signedRequest(BOUNCE_EVENT));

    const event = writes.find((w) => w.table === 'crm_email_events');
    expect(event?.payload).toMatchObject({ svix_id: SVIX_ID });
  });

  it('writes nothing further when the event was already recorded (duplicate key)', async () => {
    createAdminClient.mockImplementation(
      fakeClient({ id: 'c-1', email: 'member@example.com', do_not_email: false }, [
        { code: '23505' },
      ])
    );

    const res = await POST(await signedRequest(BOUNCE_EVENT));

    expect(res.status).toBe(200);
    expect(writes).toEqual([]);
  });
});

describe('POST /api/webhooks/resend — campaign link', () => {
  it('links the event to our broadcast from the echoed tags', async () => {
    const tagged = {
      ...BOUNCE_EVENT,
      data: {
        ...BOUNCE_EVENT.data,
        // Resend's own id, which must be ignored.
        broadcast_id: '00000000-0000-0000-0000-000000000000',
        tags: { type: 'crm-broadcast', broadcast_id: CAMPAIGN_ID },
      },
    };
    await POST(await signedRequest(tagged));

    const event = writes.find((w) => w.table === 'crm_email_events');
    expect(event?.payload).toMatchObject({ broadcast_id: CAMPAIGN_ID });
  });

  it('accepts the tags as a name/value array too', async () => {
    const tagged = {
      ...BOUNCE_EVENT,
      data: { ...BOUNCE_EVENT.data, tags: [{ name: 'broadcast_id', value: CAMPAIGN_ID }] },
    };
    await POST(await signedRequest(tagged));

    const event = writes.find((w) => w.table === 'crm_email_events');
    expect(event?.payload).toMatchObject({ broadcast_id: CAMPAIGN_ID });
  });

  it('ignores a tag that is not a UUID', async () => {
    const tagged = {
      ...BOUNCE_EVENT,
      data: { ...BOUNCE_EVENT.data, tags: { broadcast_id: 'not-a-uuid' } },
    };
    await POST(await signedRequest(tagged));

    const event = writes.find((w) => w.table === 'crm_email_events');
    expect(event?.payload).toMatchObject({ broadcast_id: null });
  });

  it('keeps the event and drops the link when the campaign does not exist', async () => {
    createAdminClient.mockImplementation(
      fakeClient({ id: 'c-1', email: 'member@example.com', do_not_email: false }, [
        { code: '23503' },
      ])
    );
    const tagged = {
      ...BOUNCE_EVENT,
      data: { ...BOUNCE_EVENT.data, tags: { broadcast_id: CAMPAIGN_ID } },
    };
    await POST(await signedRequest(tagged));

    const events = writes.filter((w) => w.table === 'crm_email_events');
    expect(events).toHaveLength(1);
    expect(events[0]?.payload).toMatchObject({ broadcast_id: null });
    // The suppression still happens — the delivery fact matters more than the link.
    expect(writes.some((w) => w.table === 'crm_contacts' && w.op === 'update')).toBe(true);
  });
});

describe('POST /api/webhooks/resend — multiple recipients', () => {
  it('processes every known recipient and skips unknown ones', async () => {
    createAdminClient.mockImplementation(
      fakeClient({
        'a@example.com': { id: 'c-a', email: 'a@example.com', do_not_email: false },
        'b@example.com': { id: 'c-b', email: 'b@example.com', do_not_email: null },
      })
    );
    const multi = {
      ...BOUNCE_EVENT,
      data: {
        ...BOUNCE_EVENT.data,
        to: ['A@example.com', 'b@example.com', 'stranger@example.com'],
      },
    };
    await POST(await signedRequest(multi));

    const updates = writes.filter((w) => w.table === 'crm_contacts' && w.op === 'update');
    expect(updates).toHaveLength(2);
    const events = writes.filter((w) => w.table === 'crm_email_events');
    expect(events.map((e) => (e.payload as { contact_id: string }).contact_id)).toEqual([
      'c-a',
      'c-b',
    ]);
  });
});
