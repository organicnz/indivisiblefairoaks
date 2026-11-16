import type { ClientRequest } from 'node:http';
import * as https from 'node:https';
import type { PushEndpointAddress } from './push-endpoint';

/** Bounds connection setup, TLS negotiation, and response reading. */
export const PUSH_TIMEOUT_MS = 5_000;

/** Push services return tiny status bodies; anything larger is discarded. */
export const MAX_PUSH_RESPONSE_BYTES = 16 * 1_024;

export type PushTransportResult =
  | { ok: true; status: number }
  | { ok: false; status: number; error: string };

export type PushTransportRequest = {
  endpoint: URL;
  addresses: readonly PushEndpointAddress[];
  headers: Record<string, string>;
  body: Buffer | null;
};

/**
 * Send one Web Push request without following redirects.
 *
 * `web-push` can build the encrypted body and VAPID headers, but its
 * `sendNotification` helper reads the response without a size limit and has no
 * total request timeout. This transport keeps those controls local.
 */
export function sendPushRequest(
  input: PushTransportRequest
): Promise<PushTransportResult> {
  return new Promise((resolve) => {
    const primary = input.addresses[0];
    if (!primary) {
      resolve({ ok: false, status: 0, error: 'push-transport-error' });
      return;
    }

    let settled = false;
    const finish = (result: PushTransportResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    // Pin the connection to the addresses checked by validatePushEndpoint.
    const lookup: https.RequestOptions['lookup'] = (_hostname, options, callback) => {
      if (options?.all) {
        callback(
          null,
          input.addresses.map(({ address, family }) => ({ address, family }))
        );
        return;
      }
      callback(null, primary.address, primary.family);
    };

    let request: ClientRequest;
    try {
      request = https.request(
        {
          hostname: input.endpoint.hostname,
          port: 443,
          path: `${input.endpoint.pathname}${input.endpoint.search}`,
          method: 'POST',
          headers: input.headers,
          lookup,
          // A fresh connection guarantees the pinned lookup is used, rather
          // than a keep-alive socket opened by an earlier request.
          agent: false,
          signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
        },
        (response) => {
          let bytes = 0;

          response.on('data', (chunk: Buffer | string) => {
            const size = typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
            bytes += size;
            if (bytes > MAX_PUSH_RESPONSE_BYTES) {
              finish({ ok: false, status: 0, error: 'push-response-too-large' });
              request.destroy();
              response.resume();
              return;
            }
          });

          response.on('end', () => {
            const status = response.statusCode ?? 0;
            if (status >= 200 && status < 300) {
              finish({ ok: true, status });
            } else {
              finish({ ok: false, status, error: `push-http-${status}` });
            }
          });

          response.on('error', () => {
            finish({ ok: false, status: 0, error: 'push-transport-error' });
          });
        }
      );
    } catch {
      resolve({ ok: false, status: 0, error: 'push-transport-error' });
      return;
    }

    request.on('error', (error: Error) => {
      finish({
        ok: false,
        status: 0,
        error: error.name === 'AbortError' ? 'push-timeout' : 'push-transport-error',
      });
    });

    try {
      request.end(input.body ?? undefined);
    } catch {
      finish({ ok: false, status: 0, error: 'push-transport-error' });
      request.destroy();
    }
  });
}
