// @vitest-environment node
import { EventEmitter } from 'node:events';
import type { RequestOptions } from 'node:https';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_PUSH_RESPONSE_BYTES,
  sendPushRequest,
  type PushTransportRequest,
} from '@/lib/push-transport';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('node:https', () => ({ request: requestMock }));

type FakeResponse = EventEmitter & {
  statusCode?: number;
  resume: ReturnType<typeof vi.fn>;
};

type FakeRequest = EventEmitter & {
  end: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

function makeResponse(statusCode = 201): FakeResponse {
  const response = new EventEmitter() as FakeResponse;
  response.statusCode = statusCode;
  response.resume = vi.fn();
  return response;
}

function makeRequest(): FakeRequest {
  const request = new EventEmitter() as FakeRequest;
  request.end = vi.fn();
  request.destroy = vi.fn();
  return request;
}

const input: PushTransportRequest = {
  endpoint: new URL('https://fcm.googleapis.com/fcm/send/abc?token=1'),
  addresses: [{ address: '8.8.8.8', family: 4 }],
  headers: { Authorization: 'vapid t=token,k=key' },
  body: Buffer.from('encrypted payload'),
};

function mockResponse(statusCode = 201, chunks: Buffer[] = [Buffer.from('ok')]) {
  requestMock.mockImplementation(
    (_options: RequestOptions, callback: (response: FakeResponse) => void) => {
      const request = makeRequest();
      request.end.mockImplementation(() => {
        const response = makeResponse(statusCode);
        callback(response);
        queueMicrotask(() => {
          for (const chunk of chunks) response.emit('data', chunk);
          response.emit('end');
        });
      });
      return request;
    }
  );
}

describe('sendPushRequest', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('posts to the fixed endpoint with a total timeout signal', async () => {
    mockResponse();
    const result = await sendPushRequest(input);

    expect(result).toEqual({ ok: true, status: 201 });
    const options = requestMock.mock.calls[0]?.[0] as RequestOptions;
    expect(options).toMatchObject({
      hostname: 'fcm.googleapis.com',
      port: 443,
      path: '/fcm/send/abc?token=1',
      method: 'POST',
      headers: input.headers,
      agent: false,
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(typeof options.lookup).toBe('function');
  });

  it('pins the request to the addresses returned by validation', async () => {
    mockResponse();
    const addresses = [
      { address: '8.8.8.8', family: 4 as const },
      { address: '1.1.1.1', family: 4 as const },
    ];
    await sendPushRequest({ ...input, addresses });

    const options = requestMock.mock.calls[0]?.[0] as RequestOptions;
    const lookup = options.lookup as unknown as (
      hostname: string,
      lookupOptions: { all?: boolean },
      callback: (
        error: Error | null,
        address: string | Array<{ address: string; family: number }>,
        family?: number
      ) => void
    ) => void;

    const all = await new Promise<unknown>((resolve) => {
      lookup('fcm.googleapis.com', { all: true }, (_error, result) => resolve(result));
    });
    expect(all).toEqual(addresses);

    const one = await new Promise<unknown>((resolve) => {
      lookup('fcm.googleapis.com', { all: false }, (_error, result) => resolve(result));
    });
    expect(one).toBe('8.8.8.8');
  });

  it('returns the provider status for a non-2xx response', async () => {
    mockResponse(410);
    await expect(sendPushRequest(input)).resolves.toEqual({
      ok: false,
      status: 410,
      error: 'push-http-410',
    });
  });

  it('maps an abort signal to the timeout result', async () => {
    const request = makeRequest();
    requestMock.mockReturnValue(request);

    const result = sendPushRequest(input);
    request.emit('error', Object.assign(new Error('aborted'), { name: 'AbortError' }));

    await expect(result).resolves.toEqual({
      ok: false,
      status: 0,
      error: 'push-timeout',
    });
  });

  it('discards a response larger than the cap', async () => {
    mockResponse(200, [Buffer.alloc(MAX_PUSH_RESPONSE_BYTES + 1)]);
    const result = await sendPushRequest(input);
    const request = requestMock.mock.results[0]?.value as FakeRequest;

    expect(result).toEqual({
      ok: false,
      status: 0,
      error: 'push-response-too-large',
    });
    expect(request.destroy).toHaveBeenCalled();
  });

  it('does not throw when the request cannot be created', async () => {
    requestMock.mockImplementation(() => {
      throw new Error('bad options');
    });

    await expect(sendPushRequest(input)).resolves.toEqual({
      ok: false,
      status: 0,
      error: 'push-transport-error',
    });
  });
});
