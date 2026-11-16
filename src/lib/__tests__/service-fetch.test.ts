// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout, ServiceTimeoutError } from '@/lib/service-fetch';

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes a successful service response through untouched', async () => {
    const response = new Response('ok');
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWithTimeout('/api/service')).resolves.toBe(response);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('aborts a hung request and reports the deadline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('The operation was aborted.', 'AbortError'))
            );
          })
      )
    );

    await expect(fetchWithTimeout('/slow-service', {}, 20)).rejects.toBeInstanceOf(
      ServiceTimeoutError
    );
  });

  it('keeps caller cancellation distinct from a service timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(init.signal?.reason ?? new DOMException('Aborted', 'AbortError'))
            );
          })
      )
    );

    const controller = new AbortController();
    const request = fetchWithTimeout('/cancelled-service', { signal: controller.signal }, 5_000);
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });
});
