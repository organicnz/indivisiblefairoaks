/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * Caveat: state lives per server isolate, so on serverless infrastructure
 * limits are enforced per-instance rather than globally. This is deliberate —
 * it raises the abuse bar (contact-form spam, error-report floods) without
 * adding an external dependency. Pair with platform-level controls
 * (Vercel Firewall) if global precision becomes necessary.
 */

const buckets = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 5000;

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: () => number = Date.now
): { ok: boolean; retryAfterSec: number } {
  const current = now();
  const hits = (buckets.get(key) ?? []).filter((t) => current - t < windowMs);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    const oldest = hits[0] ?? current;
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((windowMs - (current - oldest)) / 1000)),
    };
  }

  hits.push(current);
  buckets.set(key, hits);

  // Opportunistic GC so long-lived isolates don't accumulate dead keys.
  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const [k, v] of buckets) {
      if (v.every((t) => current - t >= windowMs)) buckets.delete(k);
      if (buckets.size <= MAX_TRACKED_KEYS / 2) break;
    }
  }

  return { ok: true, retryAfterSec: 0 };
}

/**
 * Best-effort client IP from request headers.
 *
 * Vercel overwrites x-real-ip with the true client IP (unspoofable).
 * x-forwarded-for's FIRST entry is client-controlled — trusting it lets bots
 * rotate identity per request. Fall back to the LAST forwarded entry (closest
 * proxy) where x-real-ip is absent (non-Vercel environments).
 *
 * Exported separately because a server proxy has to pass the identity to the
 * upstream service; the service cannot recover it from the proxy's own socket.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  const entries =
    forwarded
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  return headers.get('x-real-ip')?.trim() || entries[entries.length - 1] || 'unknown';
}

/** Best-effort client identity for rate-limit keys from request headers. */
export function clientKey(headers: Headers, scope: string): string {
  return `${scope}:${clientIp(headers)}`;
}
