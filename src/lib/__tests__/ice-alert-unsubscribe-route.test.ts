// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rateLimit = vi.hoisted(() => vi.fn());
const getIceAlertStore = vi.hoisted(() => vi.fn());
const findSubscriberByToken = vi.hoisted(() => vi.fn());
const updateSubscriber = vi.hoisted(() => vi.fn());

vi.mock('@/lib/rate-limit', () => ({
  rateLimit,
  clientKey: () => 'test-ip',
}));

vi.mock('@/lib/ice-alert-store', () => ({
  getIceAlertStore,
  findSubscriberByToken,
  updateSubscriber,
}));

const { GET, POST } = await import('@/app/api/ice-rapid/unsubscribe/route');

const UNSUBSCRIBE = '33333333-3333-4333-8333-333333333333';
const CONFIRM = '22222222-2222-4222-8222-222222222222';

const SUBSCRIBER = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'robin@example.com',
  email_normalized: 'robin@example.com',
  state_code: 'CA',
  city: 'Oakland',
  email_opt_in: true,
  push_opt_in: false,
  push_subscription: null,
  confirm_token: CONFIRM,
  confirm_token_expires_at: '2030-01-01T00:00:00.000Z',
  unsubscribe_token: UNSUBSCRIBE,
  confirmed_at: '2026-11-01T00:00:00.000Z',
  confirmation_sent_at: '2026-11-01T00:00:00.000Z',
  last_notified_at: null,
  last_surge_key: null,
  unsubscribed_at: null,
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-11-01T00:00:00.000Z',
};

function urlFor(token: string) {
  return `https://site.test/api/ice-rapid/unsubscribe?token=${encodeURIComponent(token)}`;
}

function formPost(token: string) {
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
  findSubscriberByToken.mockResolvedValue(SUBSCRIBER);
  updateSubscriber.mockResolvedValue(SUBSCRIBER);
});

describe('/api/ice-rapid/unsubscribe token lifecycle', () => {
  it('GET only shows the confirmation form', async () => {
    const response = await GET(new Request(urlFor(UNSUBSCRIBE)));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Stop surge alerts?');
    expect(updateSubscriber).not.toHaveBeenCalled();
  });

  it('POST rotates the confirmation token and invalidates older links', async () => {
    const response = await POST(formPost(UNSUBSCRIBE));

    expect(response.status).toBe(200);
    expect(findSubscriberByToken).toHaveBeenCalledWith(
      expect.anything(),
      'unsubscribe_token',
      UNSUBSCRIBE
    );
    expect(updateSubscriber).toHaveBeenCalledTimes(1);

    const [, id, patch] = updateSubscriber.mock.calls[0] as [
      unknown,
      string,
      Record<string, unknown>,
    ];
    expect(id).toBe(SUBSCRIBER.id);
    expect(patch).toMatchObject({
      email_opt_in: false,
      push_opt_in: false,
      push_subscription: null,
      confirmed_at: null,
      unsubscribed_at: expect.any(String),
      confirm_token_expires_at: null,
      confirmation_sent_at: null,
    });
    expect(patch.confirm_token).toEqual(expect.any(String));
    expect(patch.confirm_token).not.toBe(CONFIRM);
  });

  it('answers an RFC 8058 one-click POST with 204 and still invalidates old links', async () => {
    const response = await POST(
      new Request(urlFor(UNSUBSCRIBE), { method: 'POST' })
    );

    expect(response.status).toBe(204);
    expect(updateSubscriber).toHaveBeenCalledTimes(1);
  });

  it('does not accept a confirmation token at the unsubscribe endpoint', async () => {
    findSubscriberByToken.mockResolvedValue(null);

    const response = await POST(formPost(CONFIRM));

    expect(response.status).toBe(404);
    expect(findSubscriberByToken).toHaveBeenCalledWith(
      expect.anything(),
      'unsubscribe_token',
      CONFIRM
    );
    expect(updateSubscriber).not.toHaveBeenCalled();
  });
});
