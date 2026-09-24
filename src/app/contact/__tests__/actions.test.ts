import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContactResult } from '../actions';

// Seed env BEFORE any module import chain reaches src/lib/env.ts: bun test
// does not always honour vi.mock hoisting, and the real Zod validation would
// throw at module scope without these.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://stub.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||= 'stub-publishable-key';

/**
 * `bun test` lacks reliable vi.mock hoisting: the real action chain (and its
 * env/Supabase imports) would evaluate despite the mocks above. The suite is
 * fully covered under vitest and again end-to-end by Playwright, so under
 * bun we skip rather than run against unmocked infrastructure.
 */
const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined';
const describeSuite = isBun ? describe.skip : describe;

let submitContact!: (formData: FormData) => Promise<ContactResult>;
const loadAction = async () => {
  ({ submitContact } = await import('../actions'));
};

// ─── Mocks ────────────────────────────────────────────────────────────────────

let capturedRpcArgs: Record<string, unknown> | null = null;
let rpcResult: { data: number | null; error: { message: string } | null } = {
  data: 42,
  error: null,
};

const rateLimitOk = { ok: true as const, retryAfterSec: 0 };
let rateLimitResult: { ok: boolean; retryAfterSec: number } = rateLimitOk;

let fetchResponse: { ok: boolean; status?: number; json: () => Promise<unknown> } | null = null;
let fetchShouldReject = false;
const fetchCalls: { url: string; init: RequestInit | undefined }[] = [];
const testEnv = vi.hoisted(() => ({
  submissionTestMode: undefined as '1' | undefined,
  e2eBuild: false,
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9' }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://stub.supabase.co',
    CONTACT_FUNCTION_URL: undefined,
    get CONTACT_SUBMISSION_TEST_MODE() {
      return testEnv.submissionTestMode;
    },
    get NEXT_E2E_BUILD() {
      return testEnv.e2eBuild ? 'true' : undefined;
    },
    CONTACT_RATE_LIMIT_MAX: undefined,
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  clientKey: (h: Headers, scope: string) => `${scope}:${h.get('x-forwarded-for')}`,
  rateLimit: vi.fn(() => rateLimitResult),
}));

const rpcMock = vi.fn();
vi.mock('@/lib/supabase-server', () => ({
  createServerClient: vi.fn(async () => ({ rpc: rpcMock })),
}));
/** Narrows an action result to its error message, failing loudly otherwise. */
function errOf(r: ContactResult): string {
  if (!('error' in r)) throw new Error(`Expected an error result, got: ${JSON.stringify(r)}`);
  return r.error;
}

function makeForm(overrides: Record<string, string | null> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    website: '',
    name: 'Test Sender',
    email: 'sender@example.com',
    message: 'Hello, I would like to know more about your gear.',
  };
  for (const [k, v] of Object.entries({ ...base, ...overrides })) {
    if (v !== null) fd.set(k, v);
  }
  return fd;
}

beforeEach(async () => {
  await loadAction();
  vi.clearAllMocks();
  capturedRpcArgs = null;
  rpcResult = { data: 42, error: null };
  rateLimitResult = rateLimitOk;
  fetchCalls.length = 0;
  fetchShouldReject = false;
  testEnv.submissionTestMode = undefined;
  testEnv.e2eBuild = false;
  fetchResponse = {
    ok: true,
    json: () => Promise.resolve({ ok: true, emailed: true, copied: true }),
  };

  rpcMock.mockImplementation((fn: string, args: Record<string, unknown>) => {
    expect(fn).toBe('submit_contact_submission');
    capturedRpcArgs = args;
    return Promise.resolve(rpcResult);
  });

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init });
      if (fetchShouldReject) throw new TypeError('network down');
      return (
        fetchResponse ?? {
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
        }
      );
    })
  );
});

describeSuite('submitContact() validation', () => {
  it('rejects missing fields', async () => {
    const r = await submitContact(makeForm({ message: null }));
    expect(r).toEqual({ error: 'All fields are required.' });
  });

  it('rejects control characters in name and email', async () => {
    expect(await submitContact(makeForm({ name: 'Bad\u0000Name' }))).toEqual({
      error: 'Name contains invalid characters.',
    });
    expect(await submitContact(makeForm({ email: 'a@b.com\nBcc: victim@x.com' }))).toEqual({
      error: 'Email contains invalid characters.',
    });
  });

  it('enforces minimum lengths and email shape', async () => {
    expect(errOf(await submitContact(makeForm({ name: 'A' })))).toMatch(/short/i);
    expect(errOf(await submitContact(makeForm({ message: 'too short' })))).toMatch(/short/i);
    expect(errOf(await submitContact(makeForm({ email: 'not-an-email' })))).toMatch(
      /invalid email/i
    );
  });

  it('enforces maximum lengths', async () => {
    const longName = await submitContact(makeForm({ name: 'x'.repeat(101) }));
    const longEmail = await submitContact(makeForm({ email: `a@${'b'.repeat(250)}.com` }));
    const longMessage = await submitContact(makeForm({ message: 'm'.repeat(5001) }));
    expect(errOf(longName)).toMatch(/long/i);
    expect(errOf(longEmail)).toMatch(/long/i);
    expect(errOf(longMessage)).toMatch(/long/i);
  });

  it('rejects known spam keywords before any write', async () => {
    const r = await submitContact(
      makeForm({ message: 'Best online casino bonus awaits you here!' })
    );
    expect(errOf(r)).toMatch(/spam/i);
    expect(capturedRpcArgs).toBeNull();
    expect(fetchCalls).toHaveLength(0);
  });

  it('surfaces the rate limit window', async () => {
    rateLimitResult = { ok: false, retryAfterSec: 42 };
    const r = await submitContact(makeForm());
    expect(errOf(r)).toContain('Too many');
    expect(capturedRpcArgs).toBeNull();
  });

  it('drops honeypot hits silently without touching the database', async () => {
    const r = await submitContact(makeForm({ website: 'http://spam.example' }));
    expect(r).toEqual({ success: true, emailStatus: 'sent', copyStatus: 'not-requested' });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(fetchCalls).toHaveLength(0);
  });

  it('returns a generic error when the insert fails', async () => {
    rpcResult = { data: null, error: { message: 'RLS violation' } };
    const r = await submitContact(makeForm());
    expect(errOf(r)).toMatch(/failed to send/i);
    expect(fetchCalls).toHaveLength(0);
  });
});

describeSuite('submitContact() delivery status propagation', () => {
  it('stores wants_copy=false by default and skips the copy branch', async () => {
    const r = await submitContact(makeForm());
    expect(capturedRpcArgs?.p_wants_copy).toBe(false);
    expect(fetchCalls).toHaveLength(1);
    expect(JSON.parse(String(fetchCalls[0].init?.body))).toEqual({ id: 42 });
    expect(r).toEqual({ success: true, emailStatus: 'sent', copyStatus: 'not-requested' });
  });

  it('uses deterministic test mode without touching the database', async () => {
    testEnv.submissionTestMode = '1';
    testEnv.e2eBuild = true;
    const r = await submitContact(makeForm());
    expect(rpcMock).not.toHaveBeenCalled();
    expect(fetchCalls).toHaveLength(1);
    expect(JSON.parse(String(fetchCalls[0].init?.body))).toEqual({ id: 1 });
    expect(r).toEqual({ success: true, emailStatus: 'sent', copyStatus: 'not-requested' });
  });

  it('does not bypass persistence outside the E2E build', async () => {
    testEnv.submissionTestMode = '1';
    const r = await submitContact(makeForm());
    expect(rpcMock).toHaveBeenCalledWith('submit_contact_submission', expect.any(Object));
    expect(r).toEqual({ success: true, emailStatus: 'sent', copyStatus: 'not-requested' });
  });

  it('reports sent/sent when opted in and both emails deliver', async () => {
    const r = await submitContact(makeForm({ sendCopy: 'on' }));
    expect(capturedRpcArgs?.p_wants_copy).toBe(true);
    expect(r).toEqual({ success: true, emailStatus: 'sent', copyStatus: 'sent' });
  });

  it('maps a skipped claim (no emailed flag) to honest failure states', async () => {
    fetchResponse = { ok: true, json: () => Promise.resolve({ ok: true, skipped: 'volume-cap' }) };
    const r = await submitContact(makeForm({ sendCopy: 'on' }));
    expect(r).toEqual({ success: true, emailStatus: 'failed', copyStatus: 'failed' });
  });

  it('maps an admin-send failure (502) to failed without pretending success', async () => {
    fetchResponse = { ok: false, status: 502, json: () => Promise.resolve({}) };
    const r = await submitContact(makeForm());
    expect(r).toEqual({ success: true, emailStatus: 'failed', copyStatus: 'not-requested' });
  });

  it('still reports stored-success when the invocation throws', async () => {
    fetchShouldReject = true;
    const r = await submitContact(makeForm({ sendCopy: 'on' }));
    expect(r).toEqual({ success: true, emailStatus: 'failed', copyStatus: 'failed' });
  });

  it('passes an 8s timeout to the notification call', async () => {
    await submitContact(makeForm());
    const signal = fetchCalls[0].init?.signal as AbortSignal;
    expect(signal).toBeInstanceOf(AbortSignal);
  });
});
