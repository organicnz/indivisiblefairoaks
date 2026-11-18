// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  readFormDataWithLimit,
  readJsonBodyWithLimit,
  readTextBodyWithLimit,
} from '@/lib/request-body';

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

describe('readFormDataWithLimit', () => {
  function formRequest() {
    const form = new FormData();
    form.append('submitter_name', 'Ada');
    form.append('person_name', 'Grace');
    return new Request('https://site.test/api/ice-reunification', {
      method: 'POST',
      body: form,
    });
  }

  it('parses a multipart form', async () => {
    const result = await readFormDataWithLimit(formRequest(), 64_000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.get('submitter_name')).toBe('Ada');
      expect(result.value.get('person_name')).toBe('Grace');
    }
  });

  it('preserves uploaded file name and MIME type through the bounded parser', async () => {
    const form = new FormData();
    form.append(
      'file',
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', { type: 'image/jpeg' })
    );
    const request = new Request('https://site.test/api/visual-edit/media', {
      method: 'POST',
      body: form,
    });

    const result = await readFormDataWithLimit(request, 64_000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const file = result.value.get('file');
      expect(file).toBeInstanceOf(File);
      expect((file as File).name).toBe('photo.jpg');
      expect((file as File).type).toBe('image/jpeg');
    }
  });

  it('rejects an oversized chunked form without a declared length', async () => {
    const request = formRequest();
    request.headers.delete('content-length');

    const result = await readFormDataWithLimit(request, 100);
    expect(result).toEqual({ ok: false, code: 'too-large' });
  });

  it('rejects a non-form body', async () => {
    const request = new Request('https://site.test/api/ice-reunification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    const result = await readFormDataWithLimit(request, 100);
    expect(result).toEqual({ ok: false, code: 'invalid-form' });
  });

  it('parses a URL-encoded form', async () => {
    const request = new Request('https://site.test/api/crm/unsubscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'token=abc&confirm=1',
    });
    const result = await readFormDataWithLimit(request, 100);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.get('token')).toBe('abc');
      expect(result.value.get('confirm')).toBe('1');
    }
  });

  it('accepts the empty RFC 8058 URL-encoded post', async () => {
    const request = new Request('https://site.test/api/crm/unsubscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    const result = await readFormDataWithLimit(request, 100);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.get('token')).toBeNull();
  });
});

describe('readTextBodyWithLimit', () => {
  it('returns raw text for signature verification', async () => {
    const request = new Request('https://site.test/api/webhooks/resend', {
      method: 'POST',
      body: '{"type":"email.delivered"}',
    });
    const result = await readTextBodyWithLimit(request, 100);
    expect(result).toEqual({ ok: true, value: '{"type":"email.delivered"}' });
  });

  it('rejects an oversized body before returning text', async () => {
    const request = new Request('https://site.test/api/webhooks/resend', {
      method: 'POST',
      body: 'x'.repeat(200),
    });
    const result = await readTextBodyWithLimit(request, 100);
    expect(result).toEqual({ ok: false, code: 'too-large' });
  });
});
