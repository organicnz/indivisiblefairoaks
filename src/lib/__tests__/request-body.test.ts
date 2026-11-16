// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readJsonBodyWithLimit } from '@/lib/request-body';

function request(body: string, contentLength?: number) {
  return new Request('https://site.test/api/ice-rapid/subscribe', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(contentLength === undefined ? {} : { 'content-length': String(contentLength) }),
    },
    body,
  });
}

describe('readJsonBodyWithLimit', () => {
  it('reads valid JSON', async () => {
    const result = await readJsonBodyWithLimit(request('{"ok":true}'), 100);
    expect(result).toEqual({ ok: true, value: { ok: true } });
  });

  it('rejects a declared oversized body before reading', async () => {
    const result = await readJsonBodyWithLimit(request('{"ok":true}', 500), 100);
    expect(result).toEqual({ ok: false, code: 'too-large' });
  });

  it('enforces the limit while streaming when Content-Length is absent', async () => {
    const body = JSON.stringify({ padding: 'x'.repeat(200) });
    const result = await readJsonBodyWithLimit(request(body), 50);
    expect(result).toEqual({ ok: false, code: 'too-large' });
  });

  it('rejects malformed JSON', async () => {
    const result = await readJsonBodyWithLimit(request('{"ok":'), 100);
    expect(result).toEqual({ ok: false, code: 'invalid-json' });
  });

  it('rejects an empty body', async () => {
    const result = await readJsonBodyWithLimit(request(''), 100);
    expect(result).toEqual({ ok: false, code: 'invalid-json' });
  });
});
