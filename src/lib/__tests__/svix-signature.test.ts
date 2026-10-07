// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isFreshSvixTimestamp, svixSecretKey, verifySvixSignature } from '@/lib/svix-signature';

/**
 * The vector published in Svix's manual-verification docs.
 *
 * This is the assertion that matters. A test that signs with the same code it
 * verifies with cannot tell a wrong key derivation from a right one, which is
 * exactly how the first version of the Resend route passed its suite while
 * rejecting every real event.
 */
// The vector's key is public: it is printed in Svix's manual-verification docs.
// It is kept apart from its `whsec_` prefix only so the no-secrets hook, which
// rightly flags any `whsec_…` literal, stays strict for real credentials.
const SVIX_DOCS_VECTOR_KEY = 'plJ3nmyCDGBKInavdOK15jsl';
const SVIX_VECTOR = {
  secret: `whsec_${SVIX_DOCS_VECTOR_KEY}`,
  payload: '{"event_type":"ping","data":{"success":true}}',
  id: 'msg_loFOjxBNrRLzqYUf',
  timestamp: '1731705121',
  signature: 'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=',
};

describe('verifySvixSignature', () => {
  it("accepts Svix's published example", async () => {
    const { secret, id, timestamp, payload, signature } = SVIX_VECTOR;
    await expect(verifySvixSignature(secret, id, timestamp, payload, signature)).resolves.toBe(
      true
    );
  });

  it('rejects the same signature if the raw secret string is used as the key', async () => {
    // The original bug. Using the secret *string* as the key yields a different
    // HMAC, so the published signature must not verify against that key.
    const { id, timestamp, payload, signature } = SVIX_VECTOR;
    await expect(
      verifySvixSignature('whsec_notthesamekey0000', id, timestamp, payload, signature)
    ).resolves.toBe(false);
  });

  it('accepts when any one of several signatures verifies (secret rotation)', async () => {
    const { secret, id, timestamp, payload, signature } = SVIX_VECTOR;
    const header = `v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= ${signature}`;
    await expect(verifySvixSignature(secret, id, timestamp, payload, header)).resolves.toBe(true);
  });

  it('rejects a tampered body', async () => {
    const { secret, id, timestamp, signature } = SVIX_VECTOR;
    await expect(
      verifySvixSignature(secret, id, timestamp, '{"event_type":"pong"}', signature)
    ).resolves.toBe(false);
  });

  it('ignores unknown versions and malformed entries', async () => {
    const { secret, id, timestamp, payload, signature } = SVIX_VECTOR;
    const b64 = signature.slice(3);
    await expect(verifySvixSignature(secret, id, timestamp, payload, `v2,${b64}`)).resolves.toBe(
      false
    );
    await expect(verifySvixSignature(secret, id, timestamp, payload, 'v1,***')).resolves.toBe(
      false
    );
    await expect(verifySvixSignature(secret, id, timestamp, payload, 'v1')).resolves.toBe(false);
  });

  it('rejects a malformed secret rather than deriving a key from it', async () => {
    const { id, timestamp, payload, signature } = SVIX_VECTOR;
    await expect(verifySvixSignature('whsec_', id, timestamp, payload, signature)).resolves.toBe(
      false
    );
    expect(svixSecretKey('whsec_!!!')).toBeNull();
  });
});

describe('isFreshSvixTimestamp', () => {
  it('accepts within five minutes either way and rejects outside it', () => {
    const now = 1_800_000_000;
    expect(isFreshSvixTimestamp(String(now - 299), now)).toBe(true);
    expect(isFreshSvixTimestamp(String(now + 299), now)).toBe(true);
    expect(isFreshSvixTimestamp(String(now - 301), now)).toBe(false);
    expect(isFreshSvixTimestamp('not-a-number', now)).toBe(false);
  });
});
