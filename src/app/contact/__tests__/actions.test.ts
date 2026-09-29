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
  contactFunctionUrl: 'http://127.0.0.1:9911/notify-contact' as string | undefined,
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
    // Settable so the e2e-must-not-reach-the-live-function guard is testable.
    get CONTACT_FUNCTION_URL() {
      return testEnv.contactFunctionUrl;
    },
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

  it('accepts a message that only contains a keyword as part of a longer word', async () => {
    // The spam check used to be a bare substring match, so these were all
    // rejected as spam before any write. A resident must be able to ask about
    // parking or introduce themselves by name.
    // Only substring over-matches are covered here. "Judi" or "RTP" as a whole
    // word are still spam hits — see sanitize-keywords.test.ts, which documents
    // that residual limitation rather than hiding it.
    for (const message of [
      'I have experience in judicial and legislative work.',
      'Pragmatically, we should start the canvass in September.',
      'The vUlCaNiSeD seal on the flyer is from last year.',
    ]) {
      const r = await submitContact(makeForm({ message }));
      // 'error' in r is the rejection shape, so its absence is the assertion.
      expect('error' in r, message).toBe(false);
      expect(capturedRpcArgs, message).not.toBeNull();
      capturedRpcArgs = null;
    }
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

  it('stubs the write but still calls the notifier in an E2E build', async () => {
    // The UI under test is the visitor's real flow, including the honest
    // delivery-status banner, so the notifier is the local mock rather than a
    // bypass. `notifyUrl()` refuses to fall back to the live function in an e2e
    // build, which is what keeps a real send impossible.
    testEnv.submissionTestMode = '1';
    testEnv.e2eBuild = true;
    const r = await submitContact(makeForm());
    expect(rpcMock).not.toHaveBeenCalled();
    expect(fetchCalls).toHaveLength(1);
    expect(JSON.parse(String(fetchCalls[0].init?.body))).toEqual({ id: 1 });
    expect(r).toEqual({ success: true, emailStatus: 'sent', copyStatus: 'not-requested' });
  });

  it('refuses to reach the live notifier from an e2e build', async () => {
    // If someone drops CONTACT_FUNCTION_URL from playwright.config.ts, the
    // fallback would otherwise point a test run at the chapter's real inbox.
    testEnv.submissionTestMode = '1';
    testEnv.e2eBuild = true;
    testEnv.contactFunctionUrl = undefined;
    const r = await submitContact(makeForm());
    expect(fetchCalls).toHaveLength(0);
    expect(r).toEqual({ success: true, emailStatus: 'failed', copyStatus: 'not-requested' });
  });

  it('still emails a real submission when the E2E flag is not set', async () => {
    // The inverse guard: the bypass needs BOTH variables, so CI cannot disable
    // real delivery by setting one of them.
    testEnv.submissionTestMode = undefined;
    testEnv.e2eBuild = true;
    await submitContact(makeForm());
    expect(rpcMock).toHaveBeenCalled();
    expect(fetchCalls).toHaveLength(1);
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
