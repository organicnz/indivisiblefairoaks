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
export const ADMIN_AUDIT_OUTBOX_TABLE = 'admin_audit_outbox';

export type AdminAuditAction =
  | 'admin.role.grant'
  | 'admin.role.revoke'
  | 'admin.audit.export'
  | 'coalition_link.save'
  | 'coalition_link.delete'
  | 'crm.contact.delete'
  | 'crm.contact.bulk_delete'
  | 'crm.contact.bulk_update'
  | 'crm.contact.merge'
  | 'crm.contacts.export'
  | 'crm.contacts.import'
  | 'crm.direct_email.send'
  | 'crm.broadcast.send'
  | 'crm.broadcast.self_test'
  | 'crm.segment.save'
  | 'crm.segment.delete'
  | 'crm.task.create'
  | 'crm.task.update'
  | 'crm.task.status'
  | 'crm.task.delete'
  | 'crm.sync.historical'
  | 'content.publish'
  | 'content.unpublish'
  | 'content.media.create'
  | 'content.media.update'
  | 'content.media.delete'
  | 'data_point.save'
  | 'data_point.delete'
  | 'event.create'
  | 'event.update'
  | 'event.delete'
  | 'faq.save'
  | 'faq.delete'
  | 'media.upload'
  | 'media.delete'
  | 'newsletter.create'
  | 'newsletter.update'
  | 'newsletter.delete'
  | 'partner.save'
  | 'partner.delete'
  | 'mobilize.settings.save'
  | 'mobilize.event.import'
  | 'mobilize.event.rule'
  | 'mobilize.event.visibility'
  | 'mobilize.event.sync_lock'
  | 'mobilize.sync.run';

export type AdminAuditTargetType =
  | 'profile'
  | 'admin_audit'
  | 'coalition_link'
  | 'crm_contact'
  | 'crm_operation'
  | 'crm_broadcast'
  | 'crm_segment'
  | 'crm_task'
  | 'content'
  | 'content_media'
  | 'data_point'
  | 'event'
  | 'faq'
  | 'media_asset'
  | 'newsletter'
  | 'partner'
  | 'mobilize_settings'
  | 'mobilize_event_rule'
  | 'mobilize_sync';

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
  | {
      ok: false;
      error: string;
      /**
       * True when the complete audit payload is durable in
       * `admin_audit_outbox` and pg_cron will retry delivery. False means the
       * record could not be written or queued and the caller should report the
       * stronger failure.
       */
      queued: boolean;
    };

interface AuditInsertClient {
  from(table: string): {
    insert(values: Record<string, unknown>): PromiseLike<{
      error: { message: string; code?: string } | null;
    }>;
  };
}

/**
 * A transient database fault should not lose the only record of a privileged
 * mutation. Three attempts covers the usual pooler/connection blip without
 * holding the action open indefinitely; the delays give the pooler a moment to
 * recover rather than hammering it.
 */
const AUDIT_WRITE_ATTEMPTS = 3;
const AUDIT_RETRY_DELAYS_MS = [100, 300] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
 * Persist the exact payload that failed to reach the append-only log. The
 * outbox row and payload share the audit id, so a later delivery can use
 * `on conflict (id) do nothing` and remove the row safely even if the original
 * insert committed without its response reaching this process.
 *
 * A duplicate id is durable too: it means an earlier attempt already queued
 * this event. Only a failed insert here leaves the caller with no persisted
 * copy, which is why the result distinguishes it from the queued case.
 *
 * The enqueue gets its own small retry budget. The direct log attempts already
 * consumed the network retries, but the outbox is now the only copy; a single
 * pooler blip at this point must not turn a queued event into a lost one.
 */
const AUDIT_QUEUE_ATTEMPTS = 2;
const AUDIT_QUEUE_RETRY_DELAY_MS = 100;

async function queueAuditPayload(
  client: AuditInsertClient,
  payload: Record<string, unknown>,
  lastError: string
): Promise<boolean> {
  let lastQueueError: { message: string; code?: string } | null = null;

  for (let attempt = 0; attempt < AUDIT_QUEUE_ATTEMPTS; attempt += 1) {
    try {
      const { error } = await client.from(ADMIN_AUDIT_OUTBOX_TABLE).insert({
        id: payload.id,
        payload,
        last_error: lastError.slice(0, 2000),
      });
      if (!error || error.code === '23505') return true;
      lastQueueError = error;
    } catch (err) {
      lastQueueError = { message: errorMessage(err) };
    }

    if (attempt + 1 < AUDIT_QUEUE_ATTEMPTS) await sleep(AUDIT_QUEUE_RETRY_DELAY_MS);
  }

  console.error('[admin-audit] queue failed', {
    error: lastQueueError?.message ?? 'unknown',
    code: lastQueueError?.code,
  });
  return false;
}

/**
 * Record one privileged mutation.
 *
 * Delivery is retried a bounded number of times. Each call generates one
 * client-side UUID and reuses it for every attempt: `id` is the primary key, so
 * if the first insert committed but its response was lost, the retry collides
 * on `23505` instead of writing a second audit row. A duplicate key is
 * therefore delivery success, not failure.
 *
 * If every direct attempt fails, the complete payload is moved to
 * `admin_audit_outbox` for pg_cron to deliver. The result is still `ok: false`
 * so the caller can surface the delay, but `queued: true` means the audit record
 * is durable and retryable. Only `queued: false` means both the audit write and
 * the outbox write failed.
 *
 * This must not turn a completed mutation into a failed one; bulk callers attach
 * a warning while keeping their mutation success.
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
    return { ok: false, error, queued: false };
  }

  const payload = {
    // Generated once, before the first attempt. Retrying with a fresh id would
    // turn a committed-but-unacknowledged insert into a duplicate audit row.
    id: crypto.randomUUID(),
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

  // The generated Database type does not know this table yet. The cast is the
  // same boundary the action modules use for tables added by migrations that
  // have not been reflected in the generated types.
  const client = adminClient as AuditInsertClient;
  let lastError = 'audit write failed';
  let lastFailure: 'error' | 'threw' = 'error';

  for (let attempt = 0; attempt < AUDIT_WRITE_ATTEMPTS; attempt += 1) {
    try {
      const { error } = await client.from(ADMIN_AUDIT_TABLE).insert(payload);
      if (!error) return { ok: true };

      // The id is unique to this record. A collision means the earlier attempt
      // did commit and only its response failed, so the audit is already durable.
      if (error.code === '23505') return { ok: true };

      lastError = error.message;
      lastFailure = 'error';
    } catch (err) {
      lastError = errorMessage(err);
      lastFailure = 'threw';
    }

    const retryDelay = AUDIT_RETRY_DELAYS_MS[attempt];
    if (retryDelay !== undefined) await sleep(retryDelay);
  }

  const queued = await queueAuditPayload(client, payload, lastError);
  console.error(
    lastFailure === 'threw' ? '[admin-audit] write threw' : '[admin-audit] write failed',
    {
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      error: lastError,
      attempts: AUDIT_WRITE_ATTEMPTS,
      queued,
    }
  );
  return { ok: false, error: lastError, queued };
}
