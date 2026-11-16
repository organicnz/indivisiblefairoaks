import { decodeBase64, encodeBase64 } from '@/lib/base64';
import { env } from '@/lib/env';
import type { IceAlertPushSubscription } from '@/lib/ice-alert-store';

const VERSION = 1;
const MAX_TOKEN_LENGTH = 8_192;
const CLOCK_SKEW_MS = 5 * 60 * 1_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATE_RE = /^[A-Z]{2}$/;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Long enough for someone to find the message later, short enough that a
 * forwarded inbox is not a permanent capability to rewrite someone's alerts.
 */
export const ICE_ALERT_MANAGEMENT_TTL_MS = 24 * 60 * 60 * 1_000;

export type IceAlertManagementClaims = {
  v: 1;
  subscriberId: string;
  stateCode: string | null;
  city: string | null;
  /** Absent means keep the subscriber's existing push settings. */
  push?: IceAlertPushSubscription;
  issuedAt: number;
  expiresAt: number;
};

type CreateManagementTokenInput = {
  subscriberId: string;
  stateCode?: string | null;
  city?: string | null;
  pushSubscription?: IceAlertPushSubscription | null;
};

type ManagementTokenOptions = {
  secret?: string;
  now?: number;
  ttlMs?: number;
};

function signingSecret(options: ManagementTokenOptions) {
  return options.secret ?? env.SUPABASE_SECRET_KEY;
}

async function hmacKey(secret: string, usage: 'sign' | 'verify') {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(`ice-alert-management:v${VERSION}:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  );
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

function readPushSubscription(value: unknown): IceAlertPushSubscription | null | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const keys = record.keys;
  if (typeof record.endpoint !== 'string' || !record.endpoint.startsWith('https://')) {
    return null;
  }
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) return null;

  const keyRecord = keys as Record<string, unknown>;
  if (typeof keyRecord.p256dh !== 'string' || typeof keyRecord.auth !== 'string') {
    return null;
  }

  return {
    endpoint: record.endpoint,
    keys: {
      p256dh: keyRecord.p256dh,
      auth: keyRecord.auth,
    },
  };
}

function readClaims(value: unknown, now: number): IceAlertManagementClaims | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  if (record.v !== VERSION) return null;
  if (typeof record.subscriberId !== 'string' || !UUID_RE.test(record.subscriberId)) {
    return null;
  }

  const stateCode = record.stateCode;
  if (
    stateCode !== null &&
    (typeof stateCode !== 'string' || !STATE_RE.test(stateCode))
  ) {
    return null;
  }

  const city = record.city;
  if (city !== null && (typeof city !== 'string' || city.length === 0 || city.length > 80)) {
    return null;
  }
  if (city !== null && stateCode === null) return null;

  const push = readPushSubscription(record.push);
  if (push === null) return null;

  const issuedAt = record.issuedAt;
  const expiresAt = record.expiresAt;
  if (
    typeof issuedAt !== 'number' ||
    typeof expiresAt !== 'number' ||
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(expiresAt)
  ) {
    return null;
  }
  if (issuedAt > now + CLOCK_SKEW_MS || expiresAt <= now) return null;
  if (expiresAt - issuedAt > ICE_ALERT_MANAGEMENT_TTL_MS + CLOCK_SKEW_MS) return null;

  return {
    v: VERSION,
    subscriberId: record.subscriberId,
    stateCode: stateCode as string | null,
    city: city as string | null,
    ...(push ? { push } : {}),
    issuedAt,
    expiresAt,
  };
}

/**
 * A management token is a signed snapshot of the preferences submitted for an
 * existing subscriber. The database is not touched until the recipient opens
 * the emailed link and confirms it, so knowing an email address alone cannot
 * change an active subscription.
 */
export async function createIceAlertManagementToken(
  input: CreateManagementTokenInput,
  options: ManagementTokenOptions = {}
) {
  const secret = signingSecret(options);
  if (!secret) return null;

  const now = options.now ?? Date.now();
  const claims: IceAlertManagementClaims = {
    v: VERSION,
    subscriberId: input.subscriberId,
    stateCode: input.stateCode ?? null,
    city: input.city ?? null,
    ...(input.pushSubscription ? { push: input.pushSubscription } : {}),
    issuedAt: now,
    expiresAt: now + (options.ttlMs ?? ICE_ALERT_MANAGEMENT_TTL_MS),
  };

  const payload = encodeBase64Url(encoder.encode(JSON.stringify(claims)));
  const key = await hmacKey(secret, 'sign');
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));

  return `${payload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

/**
 * Returns null for malformed, expired, or incorrectly signed tokens. The
 * signature check uses `crypto.subtle.verify`, so it is constant-time.
 */
export async function verifyIceAlertManagementToken(
  token: string,
  options: ManagementTokenOptions = {}
): Promise<IceAlertManagementClaims | null> {
  const secret = signingSecret(options);
  if (!secret || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;

  const pieces = token.split('.');
  if (pieces.length !== 2) return null;
  const [payload, signature] = pieces;
  if (!payload || !signature) return null;

  const signatureBytes = decodeBase64Url(signature);
  if (!signatureBytes) return null;

  try {
    const key = await hmacKey(secret, 'verify');
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(payload)
    );
    if (!valid) return null;

    const payloadBytes = decodeBase64Url(payload);
    if (!payloadBytes) return null;
    const parsed: unknown = JSON.parse(decoder.decode(payloadBytes));
    return readClaims(parsed, options.now ?? Date.now());
  } catch {
    return null;
  }
}
