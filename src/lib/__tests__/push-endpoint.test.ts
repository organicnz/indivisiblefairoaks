// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  isKnownPushProviderHost,
  isPrivateOrInternalAddress,
  type PushEndpointAddress,
  type PushEndpointError,
  type PushEndpointResolver,
  validatePushEndpoint,
} from '@/lib/push-endpoint';

const PUBLIC_ADDRESS: PushEndpointAddress = { address: '8.8.8.8', family: 4 };

function publicResolver() {
  return vi.fn(async () => [PUBLIC_ADDRESS]);
}

async function expectCode(
  endpoint: string,
  code: PushEndpointError['code'],
  resolver: PushEndpointResolver = publicResolver()
) {
  await expect(validatePushEndpoint(endpoint, resolver)).rejects.toMatchObject({
    name: 'PushEndpointError',
    code,
  });
}

describe('validatePushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://android.googleapis.com/gcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc',
    'https://wns2-bl2p.notify.windows.com/w/?token=abc',
  ])('accepts a known provider endpoint: %s', async (endpoint) => {
    const resolver = publicResolver();
    const result = await validatePushEndpoint(endpoint, resolver);

    expect(result.url.toString()).toBe(new URL(endpoint).toString());
    expect(result.addresses).toEqual([PUBLIC_ADDRESS]);
    expect(resolver).toHaveBeenCalledWith(new URL(endpoint).hostname);
  });

  it('rejects an arbitrary HTTPS destination without resolving it', async () => {
    const resolver = publicResolver();
    await expectCode('https://example.com/push', 'provider-not-allowed', resolver);
    expect(resolver).not.toHaveBeenCalled();
  });

  it('rejects non-HTTPS endpoints and nonstandard ports', async () => {
    await expectCode('http://fcm.googleapis.com/push', 'insecure-protocol');
    await expectCode('https://fcm.googleapis.com:8443/push', 'nonstandard-port');
  });

  it('rejects credentials and fragments in the endpoint URL', async () => {
    await expectCode('https://user:pass@fcm.googleapis.com/push', 'credentials-not-allowed');
    await expectCode('https://fcm.googleapis.com/push#fragment', 'fragment-not-allowed');
  });

  it('rejects malformed and oversized endpoints', async () => {
    await expectCode('not a url', 'invalid-url');
    await expectCode(`https://fcm.googleapis.com/${'a'.repeat(2_100)}`, 'invalid-url');
  });

  it.each([
    'https://127.0.0.1/push',
    'https://10.0.0.5/push',
    'https://169.254.169.254/push',
    'https://[::1]/push',
    'https://[::ffff:0:127.0.0.1]/push',
    'https://[64:ff9b:1::a00:1]/push',
    'https://[fc00::1]/push',
  ])('rejects a private destination: %s', async (endpoint) => {
    await expectCode(endpoint, 'private-destination');
  });

  it.each([
    'https://localhost/push',
    'https://printer.local/push',
    'https://service.internal/push',
  ])('rejects a non-provider hostname: %s', async (endpoint) => {
    await expectCode(endpoint, 'provider-not-allowed');
  });

  it('rejects a provider hostname that resolves to a private address', async () => {
    const resolver = vi.fn(
      async (): Promise<PushEndpointAddress[]> => [{ address: '10.0.0.7', family: 4 }]
    );
    await expectCode('https://fcm.googleapis.com/push', 'private-destination', resolver);
  });

  it('rejects a provider hostname with mixed public and private answers', async () => {
    const resolver = vi.fn(
      async (): Promise<PushEndpointAddress[]> => [PUBLIC_ADDRESS, { address: '::1', family: 6 }]
    );
    await expectCode('https://fcm.googleapis.com/push', 'private-destination', resolver);
  });

  it.each(['::ffff:0:127.0.0.1', '64:ff9b:1::a00:1'])(
    'rejects a provider hostname that resolves to %s',
    async (address) => {
      const resolver = vi.fn(async (): Promise<PushEndpointAddress[]> => [{ address, family: 6 }]);
      await expectCode('https://fcm.googleapis.com/push', 'private-destination', resolver);
    }
  );

  it('fails closed when a provider hostname cannot be resolved', async () => {
    const resolver = vi.fn(async (): Promise<PushEndpointAddress[]> => {
      throw new Error('DNS outage');
    });
    await expectCode('https://fcm.googleapis.com/push', 'dns-failed', resolver);
    await expectCode('https://fcm.googleapis.com/push', 'dns-failed', async () => []);
  });
});

describe('isKnownPushProviderHost', () => {
  it('accepts exact provider hosts and their controlled subdomains', () => {
    expect(isKnownPushProviderHost('fcm.googleapis.com')).toBe(true);
    expect(isKnownPushProviderHost('FCM.GOOGLEAPIS.COM')).toBe(true);
    expect(isKnownPushProviderHost('wns2-bl2p.notify.windows.com')).toBe(true);
    expect(isKnownPushProviderHost('updates.push.services.mozilla.com')).toBe(true);
  });

  it('does not accept lookalikes or unrelated hosts', () => {
    expect(isKnownPushProviderHost('fcm.googleapis.com.evil.example')).toBe(false);
    expect(isKnownPushProviderHost('evilfcm.googleapis.com')).toBe(false);
    expect(isKnownPushProviderHost('evilnotify.windows.com')).toBe(false);
    expect(isKnownPushProviderHost('notify.windows.com.evil.example')).toBe(false);
    expect(isKnownPushProviderHost('push.services.mozilla.com')).toBe(false);
    expect(isKnownPushProviderHost('evil.push.services.mozilla.com')).toBe(false);
    expect(isKnownPushProviderHost('example.com')).toBe(false);
  });
});

describe('isPrivateOrInternalAddress', () => {
  it.each([
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.0.0.10',
    '192.0.2.1',
    '192.168.1.1',
    '198.18.0.1',
    '198.51.100.7',
    '203.0.113.9',
    '224.0.0.1',
    '240.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'fec0::1',
    'ff02::1',
    '2001:db8::1',
    '2002:7f00:1::',
    '2001:0:4136:e378::1',
    '100::1',
    '64:ff9b::7f00:1',
    '64:ff9b:1::a00:1',
    '64:ff9b:1::808:808',
    '::ffff:127.0.0.1',
    '::ffff:0:127.0.0.1',
    '::ffff:0:8.8.8.8',
    '::ffff:7f00:1',
    'not-an-ip',
  ])('treats %s as non-public', (address) => {
    expect(isPrivateOrInternalAddress(address)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '172.32.0.1',
    '192.169.0.1',
    '2606:4700:4700::1111',
    '2001:4860:4860::8888',
  ])('accepts public address %s', (address) => {
    expect(isPrivateOrInternalAddress(address)).toBe(false);
  });
});
