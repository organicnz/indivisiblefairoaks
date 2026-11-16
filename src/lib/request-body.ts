export type JsonBodyReadResult =
  | { ok: true; value: unknown }
  | { ok: false; code: 'too-large' | 'invalid-json' };

/**
 * Read a JSON request with a hard byte ceiling while the stream is being read.
 *
 * The Content-Length check is only a fast path: a client can omit it or lie
 * about it. The cumulative `byteLength` check is the actual enforcement point,
 * and the reader is cancelled as soon as the ceiling is crossed.
 */
export async function readJsonBodyWithLimit(
  request: Request,
  maxBytes: number
): Promise<JsonBodyReadResult> {
  const declared = Number(request.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, code: 'too-large' };
  }

  if (!request.body) return { ok: false, code: 'invalid-json' };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, code: 'too-large' };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, code: 'invalid-json' };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return {
      ok: true,
      value: JSON.parse(new TextDecoder().decode(bytes)) as unknown,
    };
  } catch {
    return { ok: false, code: 'invalid-json' };
  }
}
