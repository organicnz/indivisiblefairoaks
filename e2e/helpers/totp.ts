/**
 * TOTP, over WebCrypto's HMAC.
 *
 * ## Why WebCrypto rather than `node:crypto`
 *
 * `createHmac` is a Node builtin. `crypto.subtle` is a **Web standard** — it
 * exists in Bun, in Deno, in Node, and in every browser — and it produces
 * byte-identical output (verified against `createHmac` for the same key and
 * message). Using it here means this file depends on a standard rather than
 * on a runtime, and it removes the last `node:` specifier from the e2e suite.
 *
 * The trade is that `crypto.subtle` is asynchronous where `createHmac` is not,
 * so `generateTotp` returns a promise. Every call site is already inside an
 * async function.
 *
 * The HMAC is **SHA-1**, which is what RFC 6238 specifies for TOTP and is not
 * a security choice — it is a compatibility requirement, and the RFC's own
 * test vectors are the proof. The code below is checked against those
 * vectors, which are external and cannot be satisfied by a self-consistent
 * mistake.
 */

/**
 * RFC 4648 base32 → bytes, no dependency.
 *
 * The alphabet is uppercase A–Z then 2–7, and padding `=` is stripped. A real
 * TOTP seed comes out of an authenticator app as unpadded uppercase, but a
 * human copying one out of the Supabase dashboard routinely lowercases it or
 * leaves the trailing padding, so both are tolerated rather than being the
 * difference between a working spec and `Invalid TOTP code`.
 */
export function base32Decode(input: string): Uint8Array<ArrayBuffer> {
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

  return new Uint8Array(out);
}

/**
 * The code for one 30-second counter step.
 *
 * HOTP truncated to six digits (RFC 4226 §5.3): the low byte of the HMAC's last
 * nibble gives a dynamic-truncation offset, and the next four bytes are masked
 * to 31 bits so the modulo can never go negative in JavaScript's bit operators.
 */
async function hotp(secret: Uint8Array<ArrayBuffer>, counter: number): Promise<string> {
  const buf = new Uint8Array(8);
  // Big-endian: RFC 4226 puts the counter in the high bits. `setBigUint64`'s
  // third argument is `littleEndian`, and big-endian is the default.
  new DataView(buf.buffer).setBigUint64(0, BigInt(counter));

  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-1' }, false, [
    'sign',
  ]);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));

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
export async function generateTotp(
  base32Secret: string,
  stepOffset = 0,
  now = Date.now()
): Promise<string> {
  const counter = Math.floor(now / STEP_MS) + stepOffset;
  return hotp(base32Decode(base32Secret), counter);
}
