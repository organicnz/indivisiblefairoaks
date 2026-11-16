// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_SECRET = vi.hoisted(() => 'test-ice-alert-management-secret');

const rateLimit = vi.hoisted(() => vi.fn());
const getIceAlertStore = vi.hoisted(() => vi.fn());
const findSubscriberById = vi.hoisted(() => vi.fn());
const findSubscriberByToken = vi.hoisted(() => vi.fn());
const consumeIceAlertConfirmation = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SECRET_KEY: TEST_SECRET,
    NEXT_PUBLIC_SITE_URL: 'https://site.test',
    RESEND_FROM_EMAIL: 'contact@indivisiblefairoaks.org',
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit,
  clientKey: () => 'test-ip',
}));

vi.mock('@/lib/ice-alert-store', () => ({
  getIceAlertStore,
  findSubscriberById,
  findSubscriberByToken,
  consumeIceAlertConfirmation,
}));

import { GET, POST } from '@/app/api/ice-rapid/confirm/route';
import {
  createIceAlertManagementToken,
  ICE_ALERT_MANAGEMENT_TTL_MS,
} from '@/lib/ice-alert-management';

const FUTURE = '2030-01-01T00:00:00.000Z';
const PAST = '2020-01-01T00:00:00.000Z';

const SUBSCRIBER = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'Robin@Example.com',
  email_normalized: 'robin@example.com',
  state_code: 'CA',
  city: 'Oakland',
  email_opt_in: true,
  push_opt_in: false,
  push_subscription: null,
  confirm_token: '22222222-2222-4222-8222-222222222222',
  confirm_token_expires_at: FUTURE,
  unsubscribe_token: '33333333-3333-4333-8333-333333333333',
  confirmed_at: '2026-11-01T00:00:00.000Z',
  confirmation_sent_at: null,
  last_notified_at: null,
  last_surge_key: null,
  unsubscribed_at: null,
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-11-01T00:00:00.000Z',
};

const PENDING = {
  ...SUBSCRIBER,
  confirmed_at: null,
  confirmation_sent_at: null,
};

const PUSH = {
  endpoint: 'https://push.example.com/endpoint/123',
  keys: {
    p256dh: 'a'.repeat(24),
    auth: 'b'.repeat(12),
  },
};

async function signedToken(overrides: Record<string, unknown> = {}) {
  const token = await createIceAlertManagementToken(
    {
      subscriberId: SUBSCRIBER.id,
      confirmToken: SUBSCRIBER.confirm_token,
      stateCode: 'TX',
      city: 'Austin',
      pushSubscription: PUSH,
      ...overrides,
    },
    { secret: TEST_SECRET }
  );
  if (!token) throw new Error('test token was not created');
  return token;
}

function urlFor(token: string) {
  return `https://site.test/api/ice-rapid/confirm?token=${encodeURIComponent(token)}`;
}

function postForm(token: string) {
  return new Request(urlFor(token), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token, confirm: '1' }).toString(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockReturnValue({ ok: true, retryAfterSec: 0 });
  getIceAlertStore.mockReturnValue({});
  findSubscriberById.mockResolvedValue(SUBSCRIBER);
  findSubscriberByToken.mockResolvedValue(null);
  consumeIceAlertConfirmation.mockResolvedValue(SUBSCRIBER);
});

describe('/api/ice-rapid/confirm signed management tokens', () => {
  it('GET shows the requested changes without writing them', async () => {
    const token = await signedToken();

    const response = await GET(new Request(urlFor(token)));
    const page = await response.text();

    expect(response.status).toBe(200);
    expect(page).toContain('Confirm changes?');
    expect(page).toContain('Austin, TX');
    expect(findSubscriberById).toHaveBeenCalledWith(
      expect.anything(),
      SUBSCRIBER.id
    );
    expect(findSubscriberByToken).not.toHaveBeenCalled();
    expect(consumeIceAlertConfirmation).not.toHaveBeenCalled();
  });

  it('POST applies the signed preferences and consumes the token atomically', async () => {
    const token = await signedToken();

    const response = await POST(postForm(token));
    const page = await response.text();

    expect(response.status).toBe(200);
    expect(page).toContain('You&rsquo;re confirmed');
    expect(page).toContain('Austin, TX');
    expect(consumeIceAlertConfirmation).toHaveBeenCalledTimes(1);

    const [store, id, confirmToken, patch] =
      consumeIceAlertConfirmation.mock.calls[0] as [
        unknown,
        string,
        string,
        Record<string, unknown>,
      ];
    expect(store).toBeDefined();
    expect(id).toBe(SUBSCRIBER.id);
    expect(confirmToken).toBe(SUBSCRIBER.confirm_token);
    expect(patch).toMatchObject({
      state_code: 'TX',
      city: 'Austin',
      email_opt_in: true,
      push_subscription: PUSH,
      push_opt_in: true,
      confirmed_at: '2026-11-01T00:00:00.000Z',
      unsubscribed_at: null,
    });
  });

  it('rejects a tampered token without writing', async () => {
    const token = await signedToken();
    const [payload, signature] = token.split('.');
    const tampered = `${payload[0] === 'A' ? 'B' : 'A'}${payload.slice(1)}.${signature}`;

    const response = await POST(postForm(tampered));

    expect(response.status).toBe(400);
    expect(consumeIceAlertConfirmation).not.toHaveBeenCalled();
  });

  it('rejects an expired signed token without writing', async () => {
    const token = await createIceAlertManagementToken(
      {
        subscriberId: SUBSCRIBER.id,
        confirmToken: SUBSCRIBER.confirm_token,
        stateCode: 'TX',
        city: 'Austin',
      },
      {
        secret: TEST_SECRET,
        now: Date.now() - ICE_ALERT_MANAGEMENT_TTL_MS - 1_000,
        ttlMs: 1_000,
      }
    );
    if (!token) throw new Error('test token was not created');

    const response = await POST(postForm(token));

    expect(response.status).toBe(400);
    expect(consumeIceAlertConfirmation).not.toHaveBeenCalled();
  });

  it('rejects an unknown signature without looking up a subscriber', async () => {
    const token = await signedToken();
    const [payload] = token.split('.');
    const forged = `${payload}.${'A'.repeat(43)}`;

    const response = await POST(postForm(forged));

    expect(response.status).toBe(400);
    expect(findSubscriberById).not.toHaveBeenCalled();
    expect(consumeIceAlertConfirmation).not.toHaveBeenCalled();
  });

  it('rejects a replayed signed link after its token has been consumed', async () => {
    const token = await signedToken();
    findSubscriberById
      .mockResolvedValueOnce(SUBSCRIBER)
      .mockResolvedValueOnce({
        ...SUBSCRIBER,
        confirm_token: '44444444-4444-4444-8444-444444444444',
        confirm_token_expires_at: null,
      });

    const first = await POST(postForm(token));
    const second = await POST(postForm(token));

    expect(first.status).toBe(200);
    expect(second.status).toBe(410);
    expect(consumeIceAlertConfirmation).toHaveBeenCalledTimes(1);
  });

  it('rejects an expired row token even when the signed envelope is still valid', async () => {
    const token = await signedToken();
    findSubscriberById.mockResolvedValue({
      ...SUBSCRIBER,
      confirm_token_expires_at: PAST,
    });

    const response = await POST(postForm(token));

    expect(response.status).toBe(410);
    expect(consumeIceAlertConfirmation).not.toHaveBeenCalled();
  });

  it('rejects an old management link after an unsubscribe rotated the token', async () => {
    const token = await signedToken();
    findSubscriberById.mockResolvedValue({
      ...SUBSCRIBER,
      confirm_token: '55555555-5555-4555-8555-555555555555',
      confirm_token_expires_at: null,
      email_opt_in: false,
      confirmed_at: null,
      unsubscribed_at: '2026-11-02T00:00:00.000Z',
    });

    const response = await POST(postForm(token));

    expect(response.status).toBe(410);
    expect(consumeIceAlertConfirmation).not.toHaveBeenCalled();
  });
});

describe('/api/ice-rapid/confirm raw confirmation tokens', () => {
  it('confirms a pending subscriber and consumes the raw token', async () => {
    findSubscriberByToken.mockResolvedValue(PENDING);
    consumeIceAlertConfirmation.mockResolvedValue(PENDING);

    const response = await POST(postForm(PENDING.confirm_token));

    expect(response.status).toBe(200);
    expect(findSubscriberByToken).toHaveBeenCalledWith(
      expect.anything(),
      'confirm_token',
      PENDING.confirm_token
    );
    expect(consumeIceAlertConfirmation).toHaveBeenCalledWith(
      expect.anything(),
      PENDING.id,
      PENDING.confirm_token,
      {
        confirmed_at: expect.any(String),
        email_opt_in: true,
        unsubscribed_at: null,
      }
    );
  });

  it('rejects an expired raw token without writing', async () => {
    findSubscriberByToken.mockResolvedValue({
      ...PENDING,
      confirm_token_expires_at: PAST,
    });

    const response = await POST(postForm(PENDING.confirm_token));

    expect(response.status).toBe(410);
    expect(consumeIceAlertConfirmation).not.toHaveBeenCalled();
  });

  it('rejects a replayed raw link after the row token was rotated', async () => {
    findSubscriberByToken
      .mockResolvedValueOnce(PENDING)
      .mockResolvedValueOnce(null);
    consumeIceAlertConfirmation.mockResolvedValue(PENDING);

    const first = await POST(postForm(PENDING.confirm_token));
    const second = await POST(postForm(PENDING.confirm_token));

    expect(first.status).toBe(200);
    expect(second.status).toBe(404);
    expect(consumeIceAlertConfirmation).toHaveBeenCalledTimes(1);
  });
});
