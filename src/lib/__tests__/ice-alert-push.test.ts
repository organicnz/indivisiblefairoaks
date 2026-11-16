// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sendIceAlertPush } from '@/lib/ice-alert-push';

const payload = {
  title: 'ICE surge',
  body: 'A rapid response was reported nearby.',
  url: '/ice-alerts',
  tag: 'rapid-surge:test',
};

function subscription(endpoint: string) {
  return {
    endpoint,
    keys: {
      p256dh: 'p'.repeat(32),
      auth: 'a'.repeat(16),
    },
  };
}

describe('sendIceAlertPush endpoint revalidation', () => {
  it.each([
    ['https://127.0.0.1/push', 'push-endpoint-private-destination'],
    ['https://service.internal/push', 'push-endpoint-private-destination'],
    ['https://example.com/push', 'push-endpoint-provider-not-allowed'],
    ['http://fcm.googleapis.com/push', 'push-endpoint-insecure-protocol'],
  ])('rejects %s before sending', async (endpoint, error) => {
    await expect(sendIceAlertPush(subscription(endpoint), payload)).resolves.toEqual({
      ok: false,
      status: 0,
      gone: false,
      error,
    });
  });
});
