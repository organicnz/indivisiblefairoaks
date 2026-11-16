function leadingZeroBits(bytes: Uint8Array): number {
  let bits = 0;
  for (const byte of bytes) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    bits += Math.clz32(byte) - 24;
    break;
  }
  return bits;
}

/**
 * Find a nonce whose SHA-256(`${challenge}:${nonce}`) starts with the required
 * number of zero bits. Yielding periodically keeps the submit button's loading
 * state responsive on slower phones.
 */
export async function solveIceAlertProof(
  challenge: string,
  difficulty: number
): Promise<string> {
  if (!Number.isInteger(difficulty) || difficulty < 0 || difficulty > 32) {
    throw new Error('The browser check is invalid. Refresh and try again.');
  }
  if (difficulty === 0) return '0';

  if (!globalThis.crypto?.subtle) {
    throw new Error('This browser cannot complete the required check.');
  }

  const encoder = new TextEncoder();
  const maxAttempts = Math.max(100_000, 1 << Math.min(difficulty + 4, 23));

  for (let nonce = 0; nonce < maxAttempts; nonce++) {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(`${challenge}:${nonce}`)
    );
    if (leadingZeroBits(new Uint8Array(digest)) >= difficulty) {
      return String(nonce);
    }
    if ((nonce & 4095) === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  throw new Error('Could not complete the browser check. Refresh and try again.');
}
