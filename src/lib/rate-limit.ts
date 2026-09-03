/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * Caveat: state lives per server isolate, so on serverless infrastructure
 * limits are enforced per-instance rather than globally. This is deliberate —
 * it raises the abuse bar (form spam, checkout-session flooding) without
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

/** Best-effort client identity for rate-limit keys from request headers. */
export function clientKey(headers: Headers, scope: string): string {
  const forwarded = headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown';
  return `${scope}:${ip}`;
}
