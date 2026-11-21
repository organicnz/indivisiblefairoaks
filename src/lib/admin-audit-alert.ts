import { cookies } from 'next/headers';

/**
 * A persistent, admin-visible marker for a completely lost audit record.
 *
 * A record that reached neither `admin_audit_log` nor `admin_audit_outbox` has
 * no database row to inspect later. The caller still gets a warning, but a
 * toast disappears. This cookie keeps the warning in the admin shell for up to a
 * week, until an administrator acknowledges it, so the incomplete audit trail
 * is not hidden by the next page navigation.
 *
 * The value is only a timestamp; it deliberately carries no action, target or
 * error text into a browser-readable surface.
 */
export const ADMIN_AUDIT_LOSS_COOKIE = 'admin_audit_loss';
export const ADMIN_AUDIT_LOSS_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/admin',
  maxAge: ADMIN_AUDIT_LOSS_MAX_AGE_SECONDS,
};

export async function markAdminAuditLoss(at = new Date().toISOString()): Promise<void> {
  try {
    const store = await cookies();
    store.set(ADMIN_AUDIT_LOSS_COOKIE, at, COOKIE_OPTIONS);
  } catch {
    // `recordAdminAudit` already logs the loss. This marker is best-effort:
    // tests, background calls and non-request contexts must not turn it into a
    // second failure.
  }
}

export async function clearAdminAuditLoss(): Promise<void> {
  const store = await cookies();
  // `set` with maxAge 0 is used instead of a path-specific delete so older
  // browsers cannot leave a stale cookie behind after acknowledgement.
  store.set(ADMIN_AUDIT_LOSS_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 });
}
