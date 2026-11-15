// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/ice-case/route';
import { installFetchMock } from './fetch-mock';

const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};

function edgeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    headers: new Headers({ 'content-type': 'application/json' }),
  };
}

describe('POST /api/ice-case', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
  });

  afterEach(() => {
    if (env.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = env.url;
    if (env.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = env.key;
    vi.restoreAllMocks();
  });

  it('canonicalizes the city against the published snapshot before calling the function', async () => {
    const fetchMock = installFetchMock(vi.fn().mockResolvedValue(edgeResponse({ brief: 'ok' })));

    const response = await POST(
      new Request('http://localhost/api/ice-case', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-real-ip': '203.0.113.7',
          'x-forwarded-for': '198.51.100.4, 203.0.113.7',
        },
        body: JSON.stringify({ city: 'conroe', stateCode: 'tx' }),
      })
    );

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://project.supabase.co/functions/v1/ice-case-brief');
    expect(new Headers(init.headers).get('x-real-ip')).toBe('203.0.113.7');

    const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(sent).toMatchObject({
      city: 'Conroe',
      state: 'TEXAS',
      stateCode: 'TX',
      count: 29537,
      rank: 1,
      mappedRecords: 760248,
    });
    expect(sent.sourceUrl).toBe('https://deportationdata.org/data/processed/ice.html');
  });

  it('refuses a city that is not in the snapshot without calling the edge function', async () => {
    const fetchMock = installFetchMock(vi.fn().mockResolvedValue(edgeResponse({ brief: 'ok' })));

    const response = await POST(
      new Request('http://localhost/api/ice-case', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ city: 'Not A Real City', stateCode: 'TX' }),
      })
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an oversized request before parsing it', async () => {
    const fetchMock = installFetchMock(vi.fn().mockResolvedValue(edgeResponse({ brief: 'ok' })));

    const response = await POST(
      new Request('http://localhost/api/ice-case', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          city: 'Conroe',
          stateCode: 'TX',
          padding: 'x'.repeat(3_000),
        }),
      })
    );

    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes through a rate-limit response from the edge function', async () => {
    installFetchMock(
      vi.fn().mockResolvedValue(edgeResponse({ error: 'Too many requests.' }, 429))
    );

    const response = await POST(
      new Request('http://localhost/api/ice-case', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ city: 'Conroe', stateCode: 'TX' }),
      })
    );

    expect(response.status).toBe(429);
  });

  it('answers 503 when the edge request fails', async () => {
    installFetchMock(vi.fn().mockRejectedValue(new Error('network')));

    const response = await POST(
      new Request('http://localhost/api/ice-case', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ city: 'Conroe', stateCode: 'TX' }),
      })
    );

    expect(response.status).toBe(503);
  });
});
