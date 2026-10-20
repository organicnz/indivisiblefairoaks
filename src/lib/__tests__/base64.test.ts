// @vitest-environment node
//
// Base64 over the Web platform's own functions.
//
// The environment is load-bearing: Vitest's `jsdom` environment replaces the
// worker's global with the jsdom window's, and the `Bun` global does not
// survive that swap everywhere. This suite has no DOM to work with — it
// exercises `atob` and `btoa`, which are globals in every environment.
//
// `scripts/hooks/vitest-environment.mjs` enforces this for every test file
// that reaches for `Bun.*`, directly or through an imported script.
import { describe, expect, it } from 'vitest';
import { decodeBase64, decodeBase64Text, encodeBase64 } from '@/lib/base64';

describe('decodeBase64', () => {
  it('decodes to the bytes it encodes', () => {
    // The round trip is the property that matters, and it is checked against
    // a *known* value rather than against the encoder that produced it.
    expect(Array.from(decodeBase64('QUJD') as Uint8Array)).toEqual([0x41, 0x42, 0x43]);
    expect(Array.from(decodeBase64('QQ==') as Uint8Array)).toEqual([0x41]);
  });

  it('returns null for input that is not decodable', () => {
    // `atob` throws where `Buffer.from` was lenient. The answer the lenient
    // path produced — nothing usable — is preserved, as `null`.
    expect(decodeBase64('!!!')).toBeNull();
  });

  it('returns null for a well-shaped string that decodes to nothing', () => {
    // `"A"` is one base64 character. It passes every shape check, and one
    // character is not a valid encoding of anything. `Buffer.from('A',
    // 'base64')` returned zero bytes; this returns `null`.
    expect(decodeBase64('A')).toBeNull();
  });

  it('returns null for the empty string', () => {
    expect(decodeBase64('')).toBeNull();
  });

  it('returns a fresh ArrayBuffer, not a view onto a shared pool', () => {
    // `crypto.subtle.importKey` does not accept a `BufferSource` that might
    // be a view onto a shared pool — which is exactly what `Buffer.from`
    // returned, and why the old implementation had to copy the bytes.
    const bytes = decodeBase64('QUJD') as Uint8Array;
    expect(bytes.buffer).toBeInstanceOf(ArrayBuffer);
    expect(bytes.buffer.byteLength).toBe(3);
  });
});

describe('encodeBase64', () => {
  it('encodes bytes as standard base64', () => {
    expect(encodeBase64(new Uint8Array([0x41, 0x42, 0x43]))).toBe('QUJD');
    expect(encodeBase64(new Uint8Array([0x41]))).toBe('QQ==');
  });

  it('round-trips with decodeBase64', () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i;

    expect(Array.from(decodeBase64(encodeBase64(bytes)) as Uint8Array)).toEqual(Array.from(bytes));
  });

  it('encodes a large array without overflowing the argument limit', () => {
    // The `String.fromCharCode(...bytes)` form throws on a large array, and
    // a signature is a plausible size. This is the reason the encoder builds
    // the string in a loop.
    const bytes = new Uint8Array(100_000);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;

    const encoded = encodeBase64(bytes);
    expect(encoded.length).toBeGreaterThan(100_000);
    expect(decodeBase64(encoded)?.length).toBe(100_000);
  });
});

describe('decodeBase64Text', () => {
  it('decodes UTF-8 text', () => {
    // The keychain and other text-bearing payloads are UTF-8, and `atob`
    // yields a Latin-1 binary string, so the bytes go through a decoder.
    const text = 'supabase-access-token';
    const encoded = encodeBase64(new TextEncoder().encode(text));

    expect(decodeBase64Text(encoded)).toBe(text);
  });

  it('decodes non-ASCII text', () => {
    const text = 'café ☕';
    const encoded = encodeBase64(new TextEncoder().encode(text));

    expect(decodeBase64Text(encoded)).toBe(text);
  });

  it('returns null for input that is not decodable', () => {
    expect(decodeBase64Text('!!!')).toBeNull();
  });
});
