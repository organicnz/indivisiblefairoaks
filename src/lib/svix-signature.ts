/**
 * Svix webhook signature verification, used by Resend's delivery events.
 *
 * Svix HMACs `${id}.${timestamp}.${body}` with SHA-256. **The key is the
 * base64-decoded part of the signing secret after the `whsec_` prefix**, not the
 * secret as a string. The first version of the Resend route used the raw string
 * as the key, and its tests built signatures the same wrong way, so the suite
 * passed while every real Resend event would have been rejected with a 400.
 * `svix-signature.test.ts` now checks the vector from Svix's own docs, which no
 * self-consistent mistake can pass.
 */

/** Svix's own replay tolerance: five minutes either way. */
export const SVIX_TIMESTAMP_TOLERANCE_SEC = 5 * 60;

export function isFreshSvixTimestamp(
  svixTimestamp: string,
  nowSec: number = Date.now() / 1000
): boolean {
  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(nowSec - ts) <= SVIX_TIMESTAMP_TOLERANCE_SEC;
}

/** The HMAC key bytes for a `whsec_…` secret. Returns null for a malformed secret. */
export function svixSecretKey(secret: string): Uint8Array<ArrayBuffer> | null {
  const encoded = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length === 0) return null;
  // Copied into a fresh ArrayBuffer: a Node Buffer may sit on a shared pool,
  // which `crypto.subtle.importKey` does not accept as a BufferSource.
  const key = new Uint8Array(new ArrayBuffer(bytes.length));
  key.set(bytes);
  return key;
}

export async function verifySvixSignature(
  secret: string,
  svixId: string,
  svixTimestamp: string,
  rawBody: string,
  svixSignature: string
): Promise<boolean> {
  const keyBytes = svixSecretKey(secret);
  if (!keyBytes) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const signedContent = encoder.encode(`${svixId}.${svixTimestamp}.${rawBody}`);

  // Space-delimited list, each entry `v1,<base64>`. Any one verifying is enough,
  // which is what lets Svix rotate a secret without dropping events.
  for (const entry of svixSignature.split(' ')) {
    const [version, b64] = entry.trim().split(',');
    if (version !== 'v1' || !b64) continue;
    // `Buffer.from` is lenient about malformed base64, so check the shape first.
    // `crypto.subtle.verify` does the comparison in constant time.
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) continue;
    const sigBytes = Buffer.from(b64, 'base64');
    if (sigBytes.length === 0) continue;
    if (await crypto.subtle.verify('HMAC', key, sigBytes, signedContent)) return true;
  }
  return false;
}
