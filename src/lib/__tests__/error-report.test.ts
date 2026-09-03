import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ERROR_MESSAGE_MAX,
  ERROR_STACK_MAX,
  errorFingerprint,
  errorReportSchema,
  reportClientError,
} from '../error-report';

describe('errorReportSchema', () => {
  const valid = { message: 'Boom', stack: 'at fn', digest: 'abc123', path: '/products' };

  it('accepts a well-formed report', () => {
    expect(errorReportSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects empty or whitespace-only messages', () => {
    expect(errorReportSchema.safeParse({ ...valid, message: '' }).success).toBe(false);
    expect(errorReportSchema.safeParse({ ...valid, message: '   ' }).success).toBe(false);
  });

  it('rejects oversized fields', () => {
    expect(
      errorReportSchema.safeParse({ message: 'x'.repeat(ERROR_MESSAGE_MAX + 1) }).success
    ).toBe(false);
    expect(
      errorReportSchema.safeParse({
        message: 'ok',
        stack: 'x'.repeat(ERROR_STACK_MAX + 1),
      }).success
    ).toBe(false);
  });

  it('trims the message and tolerates absent optionals', () => {
    const parsed = errorReportSchema.parse({ message: '  Boom  ' });
    expect(parsed.message).toBe('Boom');
    expect(parsed.stack).toBeUndefined();
  });
});

describe('errorFingerprint', () => {
  it('produces a stable 32-char hex key for identical inputs', async () => {
    const a = await errorFingerprint('Boom', 'Error: Boom\n  at render (/app/x.tsx:1:1)');
    const b = await errorFingerprint('Boom', 'Error: Boom\n  at render (/app/x.tsx:1:1)');
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).toBe(b);
  });

  it('differs across messages and across throw sites', async () => {
    const base = await errorFingerprint('Boom', 'Error: Boom\n  at a');
    expect(await errorFingerprint('Different', 'Error: Different\n  at a')).not.toBe(base);
    expect(await errorFingerprint('Boom', 'Error: Boom\n  at b')).not.toBe(base);
  });

  it('ignores the stack header line and keys on the first real frame', async () => {
    // V8 puts "Error: Boom" (a duplicate of the message) as line one; the
    // fingerprint must be driven by the throw site below it.
    const v8 = await errorFingerprint('Boom', 'Error: Boom\n    at render (/x.tsx:1:1)');
    expect(v8).toBe(await errorFingerprint('Boom', 'Boom\n    at render (/x.tsx:1:1)'));

    // JSC/SpiderMonkey style frames (fn@url) are recognised too.
    expect(await errorFingerprint('Boom', 'render@/x.tsx:1:1')).toMatch(/^[0-9a-f]{32}$/);

    // A different throw site changes the key even when messages match.
    expect(await errorFingerprint('Boom', 'Error: Boom\n    at other (/x.tsx:9:9)')).not.toBe(v8);
  });

  it('handles a missing stack', async () => {
    expect(await errorFingerprint('Boom')).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('reportClientError', () => {
  // Runner-neutral global stub: works under vitest AND `bun test`, which
  // lacks vi.stubGlobal/unstubAllGlobals.
  const originalFetch = globalThis.fetch;
  const fetchCalls: { url: unknown; init: RequestInit | undefined }[] = [];
  let fetchResponse: Response | null = null;
  let shouldReject = false;

  const fetchMock = Object.assign(
    (url: unknown, init?: RequestInit) => {
      fetchCalls.push({ url, init });
      if (shouldReject) return Promise.reject(new TypeError('network down'));
      return Promise.resolve(fetchResponse ?? new Response(null, { status: 204 }));
    },
    {
      mockResolvedValue(res: Response) {
        fetchResponse = res;
      },
      mockReset() {
        fetchCalls.length = 0;
        fetchResponse = null;
        shouldReject = false;
      },
    }
  );

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('posts a schema-shaped payload to the beacon endpoint', () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    reportClientError(new Error('Cart blew up'), { digest: 'd1' });

    expect(fetchCalls).toHaveLength(1);
    const url = String(fetchCalls[0].url);
    const init = fetchCalls[0].init as RequestInit;
    expect(url).toBe('/api/report-error');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);

    const body = JSON.parse(init.body as string);
    expect(body.message).toBe('Cart blew up');
    expect(body.digest).toBe('d1');
    expect(typeof body.stack).toBe('string');
  });

  it('drops payloads that fail schema validation without calling fetch', () => {
    reportClientError(new Error('x'.repeat(ERROR_MESSAGE_MAX + 5)));
    expect(fetchCalls).toHaveLength(0);
  });

  it('swallows network failures silently', () => {
    shouldReject = true;
    expect(() => reportClientError(new Error('Boom'))).not.toThrow();
  });

  it('accepts plain strings as the message', () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    reportClientError('String crash');
    const init = fetchCalls[0].init as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.message).toBe('String crash');
  });
});
