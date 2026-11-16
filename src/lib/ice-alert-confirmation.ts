/**
 * Each confirmation email gets its own opaque token. The token is stored on the
 * subscriber row and cleared/rotated by the confirmation route, so a link can
 * be used once and an older link stops working when a newer one is issued.
 */

export const ICE_ALERT_CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1_000;

export type IceAlertConfirmationToken = {
  token: string;
  /** ISO timestamp; the row stores this value in `confirm_token_expires_at`. */
  expiresAt: string;
};

export function createIceAlertConfirmationToken(
  now = Date.now()
): IceAlertConfirmationToken {
  return {
    token: crypto.randomUUID(),
    expiresAt: new Date(now + ICE_ALERT_CONFIRMATION_TTL_MS).toISOString(),
  };
}

/**
 * A missing expiry is deliberately treated as expired. Rows created before
 * this lifecycle existed therefore cannot be confirmed with their old links.
 */
export function isIceAlertConfirmationTokenLive(
  expiresAt: string | null | undefined,
  now = Date.now()
): boolean {
  if (!expiresAt) return false;
  const parsed = Date.parse(expiresAt);
  return Number.isFinite(parsed) && parsed > now;
}
