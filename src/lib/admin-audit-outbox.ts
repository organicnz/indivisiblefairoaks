import { ADMIN_AUDIT_OUTBOX_TABLE } from '@/lib/admin-audit';

/**
 * Read-only health view of the durable audit outbox.
 *
 * The outbox is drained every minute by pg_cron. A row whose next attempt is
 * long past means the drain is not keeping up (or the cron job is not running);
 * a row with several failed attempts means delivery itself is failing. Both are
 * operational facts the audit page has to show, not messages buried in logs.
 */

export const ADMIN_AUDIT_OUTBOX_DISPLAY_LIMIT = 50;
/** The drain runs every minute; five minutes late is a real backlog. */
export const ADMIN_AUDIT_OUTBOX_OVERDUE_GRACE_MS = 5 * 60_000;
/** Three failed delivery passes is repeated failure, not a transient blip. */
export const ADMIN_AUDIT_OUTBOX_FAILING_ATTEMPTS = 3;

/**
 * Only the fields the health view renders are selected. PostgREST extracts
 * them from the payload and names each result after its JSON key, so a
 * record's `before`/`after` snapshots — which can hold a bulk operation's
 * full contact list — never cross the database boundary just to be discarded.
 */
const ROW_COLUMNS = [
  'id',
  'created_at',
  'attempts',
  'next_attempt_at',
  'last_error',
  'payload->>action',
  'payload->>target_type',
  'payload->>target_id',
  'payload->>target_label',
  'payload->>outcome',
  'payload->>actor_email',
].join(', ');

export type AdminAuditOutboxSeverity = 'healthy' | 'warning' | 'critical';

export interface AdminAuditOutboxRow {
  id: string;
  created_at: string;
  attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  /** Extracted from the preserved payload by the query; the rest is never read. */
  action: string | null;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  outcome: string | null;
  actor_email: string | null;
}

export interface AdminAuditOutboxHealth {
  rows: AdminAuditOutboxRow[];
  totalCount: number;
  overdueCount: number;
  failingCount: number;
  severity: AdminAuditOutboxSeverity;
  checkedAt: string;
}

interface OutboxResponse {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
}

interface OutboxQuery extends PromiseLike<OutboxResponse> {
  select(columns: string, options?: { count?: 'exact'; head?: boolean }): OutboxQuery;
  lt(column: string, value: string): OutboxQuery;
  gte(column: string, value: number): OutboxQuery;
  order(column: string, options?: { ascending?: boolean }): OutboxQuery;
  limit(count: number): PromiseLike<OutboxResponse>;
}

interface OutboxDatabase {
  from(table: string): OutboxQuery;
}

export class AdminAuditOutboxReadError extends Error {
  constructor(operation: string, cause: { message: string }) {
    super(`Could not ${operation}: ${cause.message}`);
    this.name = 'AdminAuditOutboxReadError';
  }
}

function asDatabase(adminClient: unknown): OutboxDatabase {
  // `admin_audit_outbox` is deliberately outside the generated client types.
  return adminClient as unknown as OutboxDatabase;
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function toRow(raw: Record<string, unknown>): AdminAuditOutboxRow {
  return {
    id: String(raw.id ?? ''),
    created_at: String(raw.created_at ?? ''),
    attempts: typeof raw.attempts === 'number' ? raw.attempts : 0,
    next_attempt_at: String(raw.next_attempt_at ?? ''),
    last_error: typeof raw.last_error === 'string' ? raw.last_error : null,
    action: textValue(raw.action),
    target_type: textValue(raw.target_type),
    target_id: textValue(raw.target_id),
    target_label: textValue(raw.target_label),
    outcome: textValue(raw.outcome),
    actor_email: textValue(raw.actor_email),
  };
}

function requireCount(result: OutboxResponse, operation: string): number {
  if (result.error) throw new AdminAuditOutboxReadError(operation, result.error);
  if (typeof result.count !== 'number') {
    throw new AdminAuditOutboxReadError(operation, {
      message: 'the database did not return a count',
    });
  }
  return result.count;
}

/** A row is overdue when the next retry is more than the grace period late. */
export function isAdminAuditOutboxRowOverdue(
  row: Pick<AdminAuditOutboxRow, 'next_attempt_at'>,
  checkedAt: string
): boolean {
  const next = Date.parse(row.next_attempt_at);
  const checked = Date.parse(checkedAt);
  return (
    Number.isFinite(next) &&
    Number.isFinite(checked) &&
    next < checked - ADMIN_AUDIT_OUTBOX_OVERDUE_GRACE_MS
  );
}

/** A row is repeatedly failing once delivery has failed the configured number of times. */
export function isAdminAuditOutboxRowFailing(row: Pick<AdminAuditOutboxRow, 'attempts'>): boolean {
  return row.attempts >= ADMIN_AUDIT_OUTBOX_FAILING_ATTEMPTS;
}

/**
 * Load the outbox summary and the records an operator needs to inspect.
 *
 * The display is deliberately capped, but the counts are exact database counts
 * (not counts of the displayed slice), so a large backlog cannot look healthy
 * because only the first page was checked. Rows are ordered by failed attempts
 * first, then oldest retry, so a repeatedly failing row cannot be pushed off the
 * display by a larger set of healthy retries.
 */
export async function getAdminAuditOutboxHealth(
  adminClient: unknown,
  now = new Date()
): Promise<AdminAuditOutboxHealth> {
  const checkedAt = now.toISOString();
  const overdueCutoff = new Date(now.getTime() - ADMIN_AUDIT_OUTBOX_OVERDUE_GRACE_MS).toISOString();
  const db = asDatabase(adminClient);

  const rowsQuery = db
    .from(ADMIN_AUDIT_OUTBOX_TABLE)
    .select(ROW_COLUMNS)
    .order('attempts', { ascending: false })
    .order('next_attempt_at', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(ADMIN_AUDIT_OUTBOX_DISPLAY_LIMIT);

  const [rowsResult, totalResult, overdueResult, failingResult] = await Promise.all([
    rowsQuery,
    db.from(ADMIN_AUDIT_OUTBOX_TABLE).select('id', { count: 'exact', head: true }),
    db
      .from(ADMIN_AUDIT_OUTBOX_TABLE)
      .select('id', { count: 'exact', head: true })
      .lt('next_attempt_at', overdueCutoff),
    db
      .from(ADMIN_AUDIT_OUTBOX_TABLE)
      .select('id', { count: 'exact', head: true })
      .gte('attempts', ADMIN_AUDIT_OUTBOX_FAILING_ATTEMPTS),
  ]);

  if (rowsResult.error) {
    throw new AdminAuditOutboxReadError('load the audit outbox', rowsResult.error);
  }

  if (rowsResult.data !== null && !Array.isArray(rowsResult.data)) {
    throw new AdminAuditOutboxReadError('load the audit outbox', {
      message: 'the database returned a non-list response',
    });
  }
  const data = Array.isArray(rowsResult.data) ? rowsResult.data : [];
  const rows = data
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .map(toRow);
  const totalCount = requireCount(totalResult, 'count the audit outbox');
  const overdueCount = requireCount(overdueResult, 'count overdue audit outbox records');
  const failingCount = requireCount(failingResult, 'count failing audit outbox records');

  return {
    rows,
    totalCount,
    overdueCount,
    failingCount,
    severity: failingCount > 0 ? 'critical' : overdueCount > 0 ? 'warning' : 'healthy',
    checkedAt,
  };
}
