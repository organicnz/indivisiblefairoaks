// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  createIceAlertProofChallenge,
  ICE_ALERT_PROOF_TTL_MS,
  verifyIceAlertProof,
} from '@/lib/ice-alert-proof';
import { solveIceAlertProof } from '@/components/ice-alerts/proof-of-work';

const SECRET = 'test-proof-secret';
const IP_HASH = 'a'.repeat(43);
const NOW = 1_900_000_000_000;

function challenge(difficulty = 4, now = NOW) {
  return createIceAlertProofChallenge(IP_HASH, {
    secret: SECRET,
    difficulty,
    now,
    ttlMs: 60_000,
  });
}

describe('ICE alert proof-of-work', () => {
  it('solves and verifies a challenge bound to the IP hash', async () => {
    const issued = await challenge();
    expect(issued).not.toBeNull();
    if (!issued) return;

    const nonce = await solveIceAlertProof(issued.token, issued.difficulty);
    await expect(
      verifyIceAlertProof({ token: issued.token, nonce }, IP_HASH, {
        secret: SECRET,
        now: NOW,
      })
    ).resolves.toBe(true);

    await expect(
      verifyIceAlertProof({ token: issued.token, nonce }, 'b'.repeat(43), {
        secret: SECRET,
        now: NOW,
      })
    ).resolves.toBe(false);
  });

  it('rejects a token after its expiry', async () => {
    const issued = await challenge();
    if (!issued) throw new Error('challenge was not created');
    const nonce = await solveIceAlertProof(issued.token, issued.difficulty);

    await expect(
      verifyIceAlertProof({ token: issued.token, nonce }, IP_HASH, {
        secret: SECRET,
        now: NOW + ICE_ALERT_PROOF_TTL_MS + 1,
      })
    ).resolves.toBe(false);
  });

  it('rejects a tampered token', async () => {
    const issued = await challenge();
    if (!issued) throw new Error('challenge was not created');
    const nonce = await solveIceAlertProof(issued.token, issued.difficulty);
    const [payload, signature] = issued.token.split('.');
    const tampered = `${payload[0] === 'A' ? 'B' : 'A'}${payload.slice(1)}.${signature}`;

    await expect(
      verifyIceAlertProof({ token: tampered, nonce }, IP_HASH, {
        secret: SECRET,
        now: NOW,
      })
    ).resolves.toBe(false);
  });

  it('rejects a proof signed with a different secret', async () => {
    const issued = await challenge();
    if (!issued) throw new Error('challenge was not created');
    const nonce = await solveIceAlertProof(issued.token, issued.difficulty);

    await expect(
      verifyIceAlertProof({ token: issued.token, nonce }, IP_HASH, {
        secret: 'different-secret',
        now: NOW,
      })
    ).resolves.toBe(false);
  });
});
