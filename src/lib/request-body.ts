export type JsonBodyReadResult =
  | { ok: true; value: unknown }
  | { ok: false; code: 'too-large' | 'invalid-json' };

export type TextBodyReadResult =
  | { ok: true; value: string }
  | { ok: false; code: 'too-large' | 'read-failed' };

export type FormDataReadResult =
  | { ok: true; value: FormData }
  | { ok: false; code: 'too-large' | 'invalid-form' };

type BytesReadResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; code: 'too-large' | 'read-failed' };

/**
 * Read a request body with a hard byte ceiling while the stream is being read.
 *
 * The Content-Length check is only a fast path: a client can omit it or lie
 * about it. The cumulative `byteLength` check is the actual enforcement point,
 * and the reader is cancelled as soon as the ceiling is crossed. Every body
 * parser below shares this one reader so a new content type cannot quietly
 * reintroduce an unbounded `request.text()` / `request.formData()`.
 */
async function readBytesWithLimit(request: Request, maxBytes: number): Promise<BytesReadResult> {
  const ceiling = Number.isFinite(maxBytes) ? Math.max(1, Math.floor(maxBytes)) : 1;
  const declared = Number(request.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > ceiling) {
    return { ok: false, code: 'too-large' };
  }

  if (!request.body) return { ok: false, code: 'read-failed' };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > ceiling) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, code: 'too-large' };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, code: 'read-failed' };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, bytes };
}

export async function readJsonBodyWithLimit(
  request: Request,
  maxBytes: number
): Promise<JsonBodyReadResult> {
  const read = await readBytesWithLimit(request, maxBytes);
  if (!read.ok) {
    return { ok: false, code: read.code === 'too-large' ? 'too-large' : 'invalid-json' };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(new TextDecoder().decode(read.bytes)) as unknown,
    };
  } catch {
    return { ok: false, code: 'invalid-json' };
  }
}

/** Raw text for webhook signature verification, bounded before verification. */
export async function readTextBodyWithLimit(
  request: Request,
  maxBytes: number
): Promise<TextBodyReadResult> {
  const read = await readBytesWithLimit(request, maxBytes);
  if (!read.ok) return { ok: false, code: read.code };
  return { ok: true, value: new TextDecoder().decode(read.bytes) };
}

/**
 * Read a URL-encoded or multipart form with the same streaming ceiling.
 *
 * `request.formData()` has no size cap of its own. A route that checks
 * `Content-Length` first still accepts a chunked request without that header
 * and can be made to buffer the entire upload before any file-size validation
 * runs. This collects under the ceiling first, then lets the runtime parse the
 * collected body.
 */
export async function readFormDataWithLimit(
  request: Request,
  maxBytes: number
): Promise<FormDataReadResult> {
  const contentType = request.headers.get('content-type') ?? '';
  const lower = contentType.toLowerCase();
  const isMultipart = lower.includes('multipart/form-data');
  const isUrlEncoded = lower.includes('application/x-www-form-urlencoded');
  if (!isMultipart && !isUrlEncoded) return { ok: false, code: 'invalid-form' };

  // RFC 8058 unsubscribe posts are allowed to carry an empty body; the token
  // is in the URL. An empty multipart body cannot be parsed, so only the
  // URL-encoded form gets this shortcut.
  if (!request.body) {
    return isUrlEncoded
      ? { ok: true, value: new FormData() }
      : { ok: false, code: 'invalid-form' };
  }

  const read = await readBytesWithLimit(request, maxBytes);
  if (!read.ok) {
    return { ok: false, code: read.code === 'too-large' ? 'too-large' : 'invalid-form' };
  }

  if (isUrlEncoded) {
    const form = new FormData();
    for (const [key, value] of new URLSearchParams(new TextDecoder().decode(read.bytes))) {
      form.append(key, value);
    }
    return { ok: true, value: form };
  }

  try {
    return {
      ok: true,
      value: await new Response(read.bytes.buffer as ArrayBuffer, {
        headers: { 'content-type': contentType },
      }).formData(),
    };
  } catch {
    return { ok: false, code: 'invalid-form' };
  }
}
