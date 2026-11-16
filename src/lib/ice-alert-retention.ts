/** Days a never-confirmed subscription is kept before deletion. */
export const ICE_ALERT_PENDING_RETENTION_DAYS = 7;

/** Days an unsubscribed row is kept as suppression evidence before deletion. */
export const ICE_ALERT_UNSUBSCRIBED_RETENTION_DAYS = 30;

export const ICE_ALERT_PURGE_BATCH_SIZE = 200;

export type IceAlertRetentionCutoffs = {
  pendingBefore: string;
  unsubscribedBefore: string;
};

export function iceAlertRetentionCutoffs(
  now = Date.now()
): IceAlertRetentionCutoffs {
  return {
    pendingBefore: new Date(
      now - ICE_ALERT_PENDING_RETENTION_DAYS * 24 * 60 * 60 * 1_000
    ).toISOString(),
    unsubscribedBefore: new Date(
      now - ICE_ALERT_UNSUBSCRIBED_RETENTION_DAYS * 24 * 60 * 60 * 1_000
    ).toISOString(),
  };
}
