/**
 * Append-only audit records for privileged mutations.
 *
 * This module deliberately owns no authorization. Every caller reaches it only
 * after an admin gate has verified the profile grant, a TOTP factor and an AAL2
 * session; the recorder's job is to preserve what that gate already established.
 * The table itself rejects UPDATE and DELETE, so a record cannot be rewritten
 * after the fact even by the service role.
 */
export const ADMIN_AUDIT_TABLE = 'admin_audit_log';

export type AdminAuditAction =
  | 'admin.role.grant'
  | 'admin.role.revoke'
  | 'crm.contact.delete'
  | 'crm.contact.bulk_delete'
  | 'crm.broadcast.send'
  | 'crm.broadcast.self_test'
  | 'content.publish'
  | 'content.unpublish'
  | 'event.create'
  | 'event.update'
  | 'event.delete'
  | 'newsletter.create'
  | 'newsletter.update'
  | 'newsletter.delete';

export type AdminAuditTargetType =
  | 'profile'
  | 'crm_contact'
  | 'crm_broadcast'
  | 'content'
  | 'event'
  | 'newsletter';

export type AdminAuditOutcome = 'success' | 'failure' | 'denied';

/**
 * The assurance level of the session that performed the mutation. The admin
 * gates require AAL2, so their callers pass that; `unknown` exists for a
 * best-effort write where a caller cannot establish the level rather than
 * fabricating one.
 */
export type AdminAuditMfaLevel = 'aal1' | 'aal2' | 'unknown';

export interface AdminAuditEntry {
  actorUserId: string;
  actorEmail?: string | null;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId: string;
  targetLabel?: string | null;
  before?: unknown;
  after?: unknown;
  mfaLevel?: AdminAuditMfaLevel;
  outcome: AdminAuditOutcome;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
}

export type AdminAuditResult =
  | { ok: true }
  | { ok: false; error: string };

interface AuditInsertClient {
  from(table: string): {
    insert(values: Record<string, unknown>): PromiseLike<{
      error: { message: string } | null;
    }>;
  };
}

/**
 * JSON-safe copy of a before/after value.
 *
 * Audit writes must never turn a successful mutation into a failed one because
 * a value happened to contain `undefined`, a function or a cycle. The values
 * passed here are PostgREST rows and small plain objects; the fallback is for a
 * future caller that hands over something the JSON encoder rejects.
 */
function auditJson(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Record one privileged mutation.
 *
 * Best-effort by construction: the mutation has already committed by the time
 * most callers invoke this, so a failed audit insert must not be reported as a
 * failed mutation. The failure is logged for server diagnostics instead. The
 * append-only table is the durable record; this function never updates it.
 */
export async function recordAdminAudit(
  adminClient: unknown,
  entry: AdminAuditEntry
): Promise<AdminAuditResult> {
  if (!entry.actorUserId || !entry.targetId || !entry.action) {
    const error = 'actor, target and action are required';
    console.error('[admin-audit] refusing incomplete entry', {
      action: entry.action,
      targetType: entry.targetType,
      hasActor: Boolean(entry.actorUserId),
      hasTarget: Boolean(entry.targetId),
    });
    return { ok: false, error };
  }

  const payload = {
    actor_user_id: entry.actorUserId,
    actor_email: entry.actorEmail || null,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId,
    target_label: entry.targetLabel || null,
    before: auditJson(entry.before),
    after: auditJson(entry.after),
    mfa_level: entry.mfaLevel ?? 'unknown',
    outcome: entry.outcome,
    error: entry.error ? entry.error.slice(0, 2000) : null,
    metadata: auditJson(entry.metadata),
  };

  try {
    // The generated Database type does not know this table yet. The cast is the
    // same boundary the action modules use for tables added by migrations that
    // have not been reflected in the generated types.
    const client = adminClient as AuditInsertClient;
    const { error } = await client.from(ADMIN_AUDIT_TABLE).insert(payload);
    if (error) {
      console.error('[admin-audit] write failed', {
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        error: error.message,
      });
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const message = errorMessage(err);
    console.error('[admin-audit] write threw', {
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      error: message,
    });
    return { ok: false, error: message };
  }
}
