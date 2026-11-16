// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_SECRET = vi.hoisted(() => 'test-ice-alert-management-secret');

const rateLimit = vi.hoisted(() => vi.fn());
const getIceAlertStore = vi.hoisted(() => vi.fn());
const findSubscriberById = vi.hoisted(() => vi.fn());
const findSubscriberByToken = vi.hoisted(() => vi.fn());
const updateSubscriber = vi.hoisted(() => vi.fn());

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
  updateSubscriber,
}));

import { GET, POST } from '@/app/api/ice-rapid/confirm/route';
import {
  createIceAlertManagementToken,
  ICE_ALERT_MANAGEMENT_TTL_MS,
} from '@/lib/ice-alert-management';

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
  unsubscribe_token: '33333333-3333-4333-8333-333333333333',
  confirmed_at: '2026-11-01T00:00:00.000Z',
  confirmation_sent_at: null,
  last_notified_at: null,
  last_surge_key: null,
  unsubscribed_at: null,
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-11-01T00:00:00.000Z',
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
  updateSubscriber.mockResolvedValue(SUBSCRIBER);
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
    expect(updateSubscriber).not.toHaveBeenCalled();
  });

  it('POST applies the signed preferences and confirms the subscriber', async () => {
    const token = await signedToken();

    const response = await POST(postForm(token));
    const page = await response.text();

    expect(response.status).toBe(200);
    expect(page).toContain('You&rsquo;re confirmed');
    expect(page).toContain('Austin, TX');
    expect(updateSubscriber).toHaveBeenCalledTimes(1);

    const [store, id, patch] = updateSubscriber.mock.calls[0] as [
      unknown,
      string,
      Record<string, unknown>,
    ];
    expect(store).toBeDefined();
    expect(id).toBe(SUBSCRIBER.id);
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
    const tampered = `${payload.slice(0, -1)}A.${signature}`;

    const response = await POST(postForm(tampered));

    expect(response.status).toBe(400);
    expect(updateSubscriber).not.toHaveBeenCalled();
  });

  it('rejects an expired token without writing', async () => {
    const token = await createIceAlertManagementToken(
      { subscriberId: SUBSCRIBER.id, stateCode: 'TX', city: 'Austin' },
      {
        secret: TEST_SECRET,
        now: Date.now() - ICE_ALERT_MANAGEMENT_TTL_MS - 1_000,
        ttlMs: 1_000,
      }
    );
    if (!token) throw new Error('test token was not created');

    const response = await POST(postForm(token));

    expect(response.status).toBe(400);
    expect(updateSubscriber).not.toHaveBeenCalled();
  });

  it('rejects an unknown signature without looking up a subscriber', async () => {
    const token = await signedToken();
    const [payload] = token.split('.');
    const forged = `${payload}.${'A'.repeat(43)}`;

    const response = await POST(postForm(forged));

    expect(response.status).toBe(400);
    expect(findSubscriberById).not.toHaveBeenCalled();
    expect(updateSubscriber).not.toHaveBeenCalled();
  });
});
