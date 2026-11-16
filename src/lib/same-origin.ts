/**
 * Reject browser mutations from a foreign origin before reading their body.
 * The Origin header is required for a cross-origin fetch and for same-origin
 * POSTs from modern browsers; a missing header is not treated as trusted.
 */
export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
