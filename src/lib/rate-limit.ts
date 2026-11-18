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

  /*
   * The sweep above only removes *expired* keys. With more than 5,000 active
   * identities in one window — the shape of a distributed flood — every entry
   * is live, nothing is removed, and each new address grows the map forever.
   * A per-isolate limiter must not become the memory exhaustion it exists to
   * prevent, so the ceiling is hard: evict insertion-order-oldest active keys
   * until the map fits. That lets a rotating attacker reset an old bucket, but
   * the alternative is unbounded memory; the limiter is explicitly best-effort
   * and the deployment is expected to pair it with platform-level controls.
   */
  while (buckets.size > MAX_TRACKED_KEYS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }

  return { ok: true, retryAfterSec: 0 };
}

/**
 * Best-effort client IP from request headers.
 *
 * ## Trusted-proxy assumptions
 *
 * This trusts `x-real-ip` because the production deployment is behind Vercel's
 * edge, which overwrites that header before the request reaches Next. The
 * header is only as good as that promise: a direct connection to the Next
 * server can set it freely.
 *
 * `x-forwarded-for` is not trusted from the left. Its FIRST entry is supplied
 * by the caller and can be rotated per request; the LAST entry is the hop
 * added by the nearest proxy. We use that fallback only when `x-real-ip` is
 * absent.
 *
 * If another proxy (Cloudflare, a load balancer, a local tunnel) is placed in
 * front, it must overwrite `x-real-ip` and strip the inbound
 * `x-forwarded-for` value. Otherwise clients can choose their own rate-limit
 * identity. With neither header, every request shares the `unknown` bucket.
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
