import { encodeBase64 } from '@/lib/base64';
import { env } from '@/lib/env';

const encoder = new TextEncoder();

/** One fixed window for all four dimensions. */
export const ICE_ALERT_RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

/**
 * These are deliberately low because the endpoint sends email and can create
 * push subscriptions. The global cap is the backstop when an attacker rotates
 * addresses and uses a pool of IPs.
 */
export const ICE_ALERT_RATE_LIMITS = {
  ip: 5,
  email: 3,
  endpoint: 20,
  global: 120,
} as const;

export type IceAlertRateLimitKind = 'ip' | 'email' | 'endpoint';

type HashOptions = {
  secret?: string;
};

function hashSecret(options: HashOptions) {
  return options.secret ?? env.SUPABASE_SECRET_KEY;
}

function encodeBase64Url(bytes: Uint8Array) {
  return encodeBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * The durable limit table stores only an HMAC of the IP, normalized email, and
 * endpoint host. The database therefore cannot be used as an address book, and
 * rotating the server-only secret invalidates every stored key.
 */
export async function hashIceAlertRateLimitKey(
  kind: IceAlertRateLimitKind,
  value: string,
  options: HashOptions = {}
): Promise<string | null> {
  const secret = hashSecret(options);
  if (!secret || !value) return null;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`ice-alert-rate-limit:v1:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${kind}:${value}`)
  );

  return encodeBase64Url(new Uint8Array(signature));
}

/** Extract the hostname used as the push-endpoint bucket. */
export function iceAlertEndpointHost(endpoint: string): string | null {
  try {
    return new URL(endpoint).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}
