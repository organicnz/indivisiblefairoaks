/**
 * Bounded request-body reader for Supabase Edge Functions.
 *
 * `await request.text()` / `await request.json()` buffer the entire body before
 * any size check can run, so a caller can make the isolate hold an arbitrarily
 * large payload. `content-length` is only a hint: chunked requests may omit it
 * and an attacker controls it anyway. This reads the stream incrementally and
 * cancels it the moment the ceiling is crossed.
 */

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super('request-body-too-large')
    this.name = 'RequestBodyTooLargeError'
  }
}

async function cancelBody(request: Request): Promise<void> {
  try {
    await request.body?.cancel()
  } catch {
    // Already locked, errored, or consumed — nothing left to release.
  }
}

export async function readTextBody(request: Request, maxBytes: number): Promise<string> {
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    await cancelBody(request)
    throw new RequestBodyTooLargeError()
  }

  if (!request.body) return ''

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let text = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      total += value.byteLength
      if (total > maxBytes) {
        try {
          await reader.cancel()
        } catch {
          // The stream may already be closed by the runtime.
        }
        throw new RequestBodyTooLargeError()
      }

      text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
  } finally {
    reader.releaseLock()
  }
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const raw = await readTextBody(request, maxBytes)
  if (!raw.trim()) return null
  return JSON.parse(raw)
}
