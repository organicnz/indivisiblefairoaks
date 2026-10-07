import { createHmac } from 'node:crypto';

/**
 * RFC 4648 base32 → Buffer, no dependency.
 *
 * The alphabet is uppercase A–Z then 2–7, and padding `=` is stripped. A real
 * TOTP seed comes out of an authenticator app as unpadded uppercase, but a
 * human copying one out of the Supabase dashboard routinely lowercases it or
 * leaves the trailing padding, so both are tolerated rather than being the
 * difference between a working spec and `Invalid TOTP code`.
 */
export function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');

  if (normalized.length === 0) throw new Error('TOTP secret is empty');

  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const char of normalized) {
    const index = alphabet.indexOf(char);
    if (index === -1) throw new Error(`TOTP secret contains a non-base32 character: ${char}`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }

  return Buffer.from(out);
}

/**
 * The code for one 30-second counter step.
 *
 * HOTP truncated to six digits (RFC 4226 §5.3): the low byte of the HMAC's last
 * nibble gives a dynamic-truncation offset, and the next four bytes are masked
 * to 31 bits so the modulo can never go negative in JavaScript's bit operators.
 */
function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', secret).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, '0');
}

const STEP_MS = 30_000;

/** Milliseconds remaining in the current code's validity window. */
export function msRemainingInStep(now = Date.now()): number {
  return STEP_MS - (now % STEP_MS);
}

/**
 * Generate the code for a seed, optionally from an earlier step.
 *
 * `stepOffset: -1` returns the *previous* window's code. That matters for the
 * "wrong code" assertions: a code generated for step N is accepted by GoTrue
 * for a small skew window around it, so a genuinely invalid code cannot be
 * synthesised by asking for a neighbouring step.
 */
export function generateTotp(base32Secret: string, stepOffset = 0, now = Date.now()): string {
  const counter = Math.floor(now / STEP_MS) + stepOffset;
  return hotp(base32Decode(base32Secret), counter);
}
