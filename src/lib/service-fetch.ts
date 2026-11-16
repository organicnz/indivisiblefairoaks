/**
 * Public service requests need a deadline. A hung Supabase or API request
 * otherwise leaves a server-rendered page — or a client loading state — waiting
 * indefinitely, even though every caller already has an empty/fallback state.
 *
 * This wrapper is deliberately dependency-free so it can run on the server, in
 * the browser, and on the Edge runtime. Callers keep their existing error
 * handling; a timeout is just another rejected service request.
 */
export const SERVICE_TIMEOUT_MS = 8_000;

export class ServiceTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Service request timed out after ${timeoutMs}ms`);
    this.name = 'ServiceTimeoutError';
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = SERVICE_TIMEOUT_MS
): Promise<Response> {
  const callerSignal = init.signal;
  if (callerSignal?.aborted) {
    throw callerSignal.reason ?? new DOMException('Aborted', 'AbortError');
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  callerSignal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    // Keep a caller's deliberate cancellation distinct from our deadline so
    // retry/UI logic can tell "navigated away" from "service is slow".
    if (timedOut) throw new ServiceTimeoutError(timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}
