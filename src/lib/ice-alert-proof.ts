import { decodeBase64, encodeBase64 } from '@/lib/base64';
import { env } from '@/lib/env';

const VERSION = 1;
const MAX_TOKEN_LENGTH = 4_096;
const CLOCK_SKEW_MS = 5 * 60 * 1_000;
const MIN_DIFFICULTY_BITS = 4;
const MAX_DIFFICULTY_BITS = 24;
const MAX_PROOF_NONCE_DIGITS = 10;
const NONCE_RE = /^[A-Za-z0-9_-]{16,64}$/;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** A quick browser check that makes bulk submissions meaningfully more costly. */
export const ICE_ALERT_PROOF_DIFFICULTY_BITS = 18;
export const ICE_ALERT_PROOF_TTL_MS = 10 * 60 * 1_000;

type ProofOptions = {
  secret?: string;
  now?: number;
  ttlMs?: number;
  difficulty?: number;
};

export type IceAlertProofChallenge = {
  token: string;
  difficulty: number;
  expiresAt: number;
  issuedAt: number;
  ipHash: string;
};

type ChallengeClaims = Omit<IceAlertProofChallenge, 'token'> & {
  v: 1;
  nonce: string;
};

export type IceAlertProof = {
  token: string;
  nonce: string;
};

function proofSecret(options: ProofOptions) {
  return options.secret ?? env.SUPABASE_SECRET_KEY;
}

function encodeBase64Url(bytes: Uint8Array) {
  return encodeBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const standard = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4);
  return decodeBase64(padded);
}

async function hmacKey(secret: string, usage: 'sign' | 'verify') {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(`ice-alert-proof:v${VERSION}:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  );
}

function randomNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

export function leadingZeroBits(bytes: Uint8Array): number {
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

function readChallenge(value: unknown, now: number): ChallengeClaims | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  if (record.v !== VERSION) return null;
  if (typeof record.nonce !== 'string' || !NONCE_RE.test(record.nonce)) return null;
  if (typeof record.ipHash !== 'string' || record.ipHash.length < 16 || record.ipHash.length > 128) {
    return null;
  }

  const issuedAt = record.issuedAt;
  const expiresAt = record.expiresAt;
  const difficulty = record.difficulty;
  if (
    typeof issuedAt !== 'number' ||
    typeof expiresAt !== 'number' ||
    typeof difficulty !== 'number' ||
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(expiresAt) ||
    !Number.isSafeInteger(difficulty)
  ) {
    return null;
  }
  if (issuedAt > now + CLOCK_SKEW_MS || expiresAt <= now) return null;
  if (expiresAt - issuedAt > ICE_ALERT_PROOF_TTL_MS + CLOCK_SKEW_MS) return null;
  if (difficulty < MIN_DIFFICULTY_BITS || difficulty > MAX_DIFFICULTY_BITS) {
    return null;
  }

  return {
    v: VERSION,
    nonce: record.nonce,
    ipHash: record.ipHash,
    issuedAt,
    expiresAt,
    difficulty,
  };
}

/**
 * Issue a short-lived challenge bound to the HMAC of the caller's IP. The
 * browser must find a nonce whose SHA-256 digest starts with `difficulty` zero
 * bits. The token is signed so the server can verify it without a second
 * database write just to hand out a challenge.
 */
export async function createIceAlertProofChallenge(
  ipHash: string,
  options: ProofOptions = {}
): Promise<IceAlertProofChallenge | null> {
  const secret = proofSecret(options);
  if (!secret || !ipHash) return null;

  const now = options.now ?? Date.now();
  const difficulty = options.difficulty ?? ICE_ALERT_PROOF_DIFFICULTY_BITS;
  if (
    !Number.isInteger(difficulty) ||
    difficulty < MIN_DIFFICULTY_BITS ||
    difficulty > MAX_DIFFICULTY_BITS
  ) {
    return null;
  }

  const claims: ChallengeClaims = {
    v: VERSION,
    nonce: randomNonce(),
    ipHash,
    issuedAt: now,
    expiresAt: now + (options.ttlMs ?? ICE_ALERT_PROOF_TTL_MS),
    difficulty,
  };
  const payload = encodeBase64Url(encoder.encode(JSON.stringify(claims)));
  const key = await hmacKey(secret, 'sign');
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));

  return {
    token: `${payload}.${encodeBase64Url(new Uint8Array(signature))}`,
    difficulty: claims.difficulty,
    expiresAt: claims.expiresAt,
    issuedAt: claims.issuedAt,
    ipHash: claims.ipHash,
  };
}

export async function verifyIceAlertProof(
  proof: IceAlertProof,
  ipHash: string,
  options: ProofOptions = {}
): Promise<boolean> {
  const secret = proofSecret(options);
  if (
    !secret ||
    !proof.token ||
    proof.token.length > MAX_TOKEN_LENGTH ||
    !new RegExp(`^\\d{1,${MAX_PROOF_NONCE_DIGITS}}$`).test(proof.nonce)
  ) {
    return false;
  }

  const pieces = proof.token.split('.');
  if (pieces.length !== 2) return false;
  const [payload, signature] = pieces;
  if (!payload || !signature) return false;

  const signatureBytes = decodeBase64Url(signature);
  if (!signatureBytes) return false;

  try {
    const key = await hmacKey(secret, 'verify');
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(payload)
    );
    if (!valid) return false;

    const payloadBytes = decodeBase64Url(payload);
    if (!payloadBytes) return false;
    const claims = readChallenge(
      JSON.parse(decoder.decode(payloadBytes)) as unknown,
      options.now ?? Date.now()
    );
    if (!claims || claims.ipHash !== ipHash) return false;

    const digest = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(`${proof.token}:${proof.nonce}`)
    );
    return leadingZeroBits(new Uint8Array(digest)) >= claims.difficulty;
  } catch {
    return false;
  }
}
