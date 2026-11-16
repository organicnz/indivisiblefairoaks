// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  createIceAlertConfirmationToken,
  ICE_ALERT_CONFIRMATION_TTL_MS,
  isIceAlertConfirmationTokenLive,
} from '@/lib/ice-alert-confirmation';

const NOW = 1_900_000_000_000;

describe('ICE alert confirmation tokens', () => {
  it('creates an opaque token with a 24-hour expiry', () => {
    const confirmation = createIceAlertConfirmationToken(NOW);

    expect(confirmation.token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(confirmation.expiresAt).toBe(
      new Date(NOW + ICE_ALERT_CONFIRMATION_TTL_MS).toISOString()
    );
  });

  it('treats missing or past expiries as expired', () => {
    expect(isIceAlertConfirmationTokenLive(null, NOW)).toBe(false);
    expect(isIceAlertConfirmationTokenLive(undefined, NOW)).toBe(false);
    expect(isIceAlertConfirmationTokenLive(new Date(NOW).toISOString(), NOW)).toBe(false);
    expect(
      isIceAlertConfirmationTokenLive(new Date(NOW + 1).toISOString(), NOW)
    ).toBe(true);
  });
});
