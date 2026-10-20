/**
 * Base64, over the Web platform's own functions.
 *
 * ## Why this module exists
 *
 * `Buffer` is a **Node API**. `atob` and `btoa` are **Web standards** — present
 * in browsers, in Node (16 and later), in Bun, in Deno, and on the Edge
 * runtime — and they are the same functions this repository's Edge
 * Functions and client components can rely on.
 *
 * That is the trade the e2e suite's TOTP helper already made when
 * `createHmac` gave way to `crypto.subtle`: a standard that works everywhere
 * beats a runtime-specific API that works almost everywhere. The webhook
 * verifier was the last `Buffer` in `src/`, and the reason it was left alone
 * was never that `Buffer` was better — it was that the obvious replacement,
 * `Uint8Array.fromBase64`, is a Bun/Deno/modern-V8 API that is **not** in
 * Node 20 or 22, so a swap would have been green in tests and broken on a
 * Node function. `atob` has neither problem.
 *
 * ## The one behaviour difference
 *
 * `Buffer.from(value, 'base64')` is **lenient**: it decodes whatever it can
 * and ignores the rest. `atob` **throws** on input that is not valid base64.
 *
 * So `decodeBase64` reports "not decodable" as `null` rather than throwing,
 * which is the answer the lenient path produced by handing back zero bytes.
 * A caller that wants to distinguish "malformed" from "empty" can, and a
 * caller that only wants bytes does not have to know that the two encoders
 * disagree.
 */

/**
 * Decode standard base64 into bytes, or `null` when it cannot be decoded.
 *
 * @param value Standard base64 — the alphabet is `A–Z a–z 0–9 + /`, with `=`
 *   padding.
 * @returns The decoded bytes, or `null` when the input is not decodable.
 */
export function decodeBase64(value: string): Uint8Array<ArrayBuffer> | null {
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    return null;
  }
  if (binary.length === 0) return null;

  // `atob` returns a *binary string* — one character per byte, Latin-1 — so
  // the bytes are the characters' code points.
  //
  // `new Uint8Array(n)` allocates a fresh `ArrayBuffer`, which matters:
  // `crypto.subtle.importKey` does not accept a `BufferSource` that might be
  // a view onto a shared pool, which is what `Buffer.from` returned.
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Encode bytes as standard base64.
 *
 * @param bytes The bytes to encode.
 * @returns The base64 text, with `=` padding.
 */
export function encodeBase64(bytes: Uint8Array): string {
  // Built in a loop rather than with `String.fromCharCode(...bytes)`: the
  // spread form throws on a large array, and a signature is a plausible size.
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Decode standard base64 into a UTF-8 string.
 *
 * The other direction from {@link decodeBase64}: `atob` yields a Latin-1
 * binary string, and text is UTF-8, so the bytes go through a `TextDecoder`.
 *
 * @param value Standard base64.
 * @returns The decoded text, or `null` when the input is not decodable.
 */
export function decodeBase64Text(value: string): string | null {
  const bytes = decodeBase64(value);
  if (!bytes) return null;
  return new TextDecoder().decode(bytes);
}
