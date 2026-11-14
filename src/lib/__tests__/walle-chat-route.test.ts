// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/wall-e-chat/route';
import { installFetchMock } from './fetch-mock';

const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};

describe('POST /api/wall-e-chat', () => {
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

  it('forwards the trusted client address so the edge rate limit is per visitor', async () => {
    const fetchMock = installFetchMock(
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ answer: 'Hello.' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      })
    );

    const response = await POST(
      new Request('http://localhost/api/wall-e-chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-real-ip': '203.0.113.7',
          'x-forwarded-for': '198.51.100.4, 203.0.113.7',
        },
        body: JSON.stringify({ message: 'Hello' }),
      })
    );

    expect(response.status).toBe(200);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(new Headers(init?.headers).get('x-real-ip')).toBe('203.0.113.7');
  });

  it('falls back to the nearest forwarded hop when x-real-ip is absent', async () => {
    const fetchMock = installFetchMock(
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ answer: 'Hello.' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      })
    );

    await POST(
      new Request('http://localhost/api/wall-e-chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.4, 203.0.113.7',
        },
        body: JSON.stringify({ message: 'Hello' }),
      })
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(new Headers(init?.headers).get('x-real-ip')).toBe('203.0.113.7');
  });
});
