import {
  ADMIN_AUDIT_TABLE,
  type AdminAuditAction,
  type AdminAuditOutcome,
  type AdminAuditTargetType,
} from '@/lib/admin-audit';

/**
 * Read-only access to the append-only admin audit log.
 *
 * This module owns filtering, pagination, CSV serialization and presentation
 * labels. It never writes: the audit table has no UPDATE/DELETE grant and its
 * own triggers reject either operation, so the explorer cannot become a second
 * mutation path by accident.
 */

export const ADMIN_AUDIT_PAGE_SIZE = 50;
export const ADMIN_AUDIT_EXPORT_BATCH_SIZE = 1_000;
export const ADMIN_AUDIT_MAX_EXPORT_ROWS = 20_000;

const LIST_COLUMNS =
  'id, created_at, actor_user_id, actor_email, action, target_type, target_id, target_label, mfa_level, outcome, error';
const EXPORT_COLUMNS =
  'id, created_at, actor_user_id, actor_email, action, target_type, target_id, target_label, mfa_level, outcome, error, before, after, metadata';

export interface AdminAuditActionOption {
  value: AdminAuditAction;
  label: string;
}

export const ADMIN_AUDIT_ACTION_LABELS: Record<AdminAuditAction, string> = {
  'admin.role.grant': 'Admin role granted',
  'admin.role.revoke': 'Admin role revoked',
  'admin.audit.export': 'Audit log exported',
  'coalition_link.save': 'Coalition link saved',
  'coalition_link.delete': 'Coalition link deleted',
  'crm.contact.delete': 'Contact deleted',
  'crm.contact.bulk_delete': 'Bulk contacts deleted',
  'crm.contact.bulk_update': 'Bulk contacts updated',
  'crm.contact.merge': 'Contacts merged',
  'crm.contacts.export': 'Contacts exported',
  'crm.contacts.import': 'Contacts imported',
  'crm.direct_email.send': 'Direct email sent',
  'crm.broadcast.send': 'Broadcast sent',
  'crm.broadcast.self_test': 'Broadcast self-test',
  'crm.segment.save': 'Segment saved',
  'crm.segment.delete': 'Segment deleted',
  'crm.task.create': 'Follow-up created',
  'crm.task.update': 'Follow-up updated',
  'crm.task.status': 'Follow-up status changed',
  'crm.task.delete': 'Follow-up deleted',
  'crm.sync.historical': 'Historical CRM sync run',
  'content.publish': 'Content published',
  'content.unpublish': 'Content unpublished',
  'content.media.create': 'Media created',
  'content.media.update': 'Media updated',
  'content.media.delete': 'Media deleted',
  'data_point.save': 'Data point saved',
  'data_point.delete': 'Data point deleted',
  'event.create': 'Event created',
  'event.update': 'Event updated',
  'event.delete': 'Event deleted',
  'faq.save': 'FAQ saved',
  'faq.delete': 'FAQ deleted',
  'media.upload': 'Media uploaded',
  'media.delete': 'Media deleted',
  'newsletter.create': 'Newsletter created',
  'newsletter.update': 'Newsletter updated',
  'newsletter.delete': 'Newsletter deleted',
  'partner.save': 'Partner saved',
  'partner.delete': 'Partner deleted',
  'mobilize.settings.save': 'Mobilize settings saved',
  'mobilize.event.import': 'Mobilize event imported',
  'mobilize.event.rule': 'Mobilize event rule changed',
  'mobilize.event.visibility': 'Mobilize event visibility changed',
  'mobilize.event.sync_lock': 'Mobilize event sync lock changed',
  'mobilize.sync.run': 'Mobilize sync run',
};

export const ADMIN_AUDIT_ACTION_OPTIONS: AdminAuditActionOption[] = (
  Object.entries(ADMIN_AUDIT_ACTION_LABELS) as [AdminAuditAction, string][]
).map(([value, label]) => ({ value, label }));

export const ADMIN_AUDIT_TARGET_TYPE_LABELS: Record<AdminAuditTargetType, string> = {
  profile: 'Admin profile',
  admin_audit: 'Audit log',
  coalition_link: 'Coalition link',
  crm_contact: 'Constituent',
  crm_operation: 'CRM operation',
  crm_broadcast: 'Broadcast',
  crm_segment: 'Saved segment',
  crm_task: 'Follow-up',
  content: 'Page or post',
  content_media: 'Media item',
  data_point: 'Data point',
  event: 'Event',
  faq: 'FAQ',
  media_asset: 'Media asset',
  newsletter: 'Newsletter',
  partner: 'Partner',
  mobilize_settings: 'Mobilize settings',
  mobilize_event_rule: 'Mobilize event rule',
  mobilize_sync: 'Mobilize sync',
};

export const ADMIN_AUDIT_TARGET_TYPE_OPTIONS: {
  value: AdminAuditTargetType;
  label: string;
}[] = (Object.entries(ADMIN_AUDIT_TARGET_TYPE_LABELS) as [AdminAuditTargetType, string][]).map(
  ([value, label]) => ({ value, label })
);

export const ADMIN_AUDIT_OUTCOME_LABELS: Record<AdminAuditOutcome, string> = {
  success: 'Success',
  failure: 'Failure',
  denied: 'Denied',
};

export interface AdminAuditFilters {
  actor: string;
  action: AdminAuditAction | '';
  outcome: AdminAuditOutcome | '';
  from: string;
  to: string;
  targetType: AdminAuditTargetType | '';
  target: string;
}

export const EMPTY_ADMIN_AUDIT_FILTERS: AdminAuditFilters = {
  actor: '',
  action: '',
  outcome: '',
  from: '',
  to: '',
  targetType: '',
  target: '',
};

export interface AdminAuditListRow {
  id: string;
  created_at: string;
  actor_user_id: string;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string;
  target_label: string | null;
  mfa_level: string;
  outcome: string;
  error: string | null;
}

export interface AdminAuditOperation extends AdminAuditListRow {
  before: unknown;
  after: unknown;
  metadata: unknown;
}

export interface AdminAuditPage {
  rows: AdminAuditListRow[];
  totalCount: number;
}

interface AuditResponse {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
}

interface AuditQuery extends PromiseLike<AuditResponse> {
  select(columns: string, options?: { count?: 'exact'; head?: boolean }): AuditQuery;
  eq(column: string, value: unknown): AuditQuery;
  ilike(column: string, pattern: string): AuditQuery;
  or(expression: string): AuditQuery;
  gte(column: string, value: string): AuditQuery;
  lte(column: string, value: string): AuditQuery;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): AuditQuery;
  range(from: number, to: number): PromiseLike<AuditResponse>;
  maybeSingle(): PromiseLike<AuditResponse>;
}

interface AuditDatabase {
  from(table: string): AuditQuery;
}

export class AdminAuditReadError extends Error {
  constructor(operation: string, cause: { message: string }) {
    super(`Could not ${operation}: ${cause.message}`);
    this.name = 'AdminAuditReadError';
  }
}

export class AdminAuditExportTooLargeError extends Error {
  constructor(readonly totalCount: number) {
    super(
      `This export matches ${totalCount.toLocaleString('en-US')} operations. Narrow the filters to ${ADMIN_AUDIT_MAX_EXPORT_ROWS.toLocaleString('en-US')} or fewer.`
    );
    this.name = 'AdminAuditExportTooLargeError';
  }
}

function asDatabase(adminClient: unknown): AuditDatabase {
  // The generated Database type predates admin_audit_log, so the audit reader
  // crosses the same untyped boundary as the other admin queries.
  return adminClient as unknown as AuditDatabase;
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isAction(value: string): value is AdminAuditAction {
  return Object.hasOwn(ADMIN_AUDIT_ACTION_LABELS, value);
}

function isTargetType(value: string): value is AdminAuditTargetType {
  return Object.hasOwn(ADMIN_AUDIT_TARGET_TYPE_LABELS, value);
}

function isOutcome(value: string): value is AdminAuditOutcome {
  return Object.hasOwn(ADMIN_AUDIT_OUTCOME_LABELS, value);
}

function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Normalize a query string into the only filter values the database accepts. */
export function parseAdminAuditFilters(
  params: Record<string, string | string[] | undefined>
): AdminAuditFilters {
  const actor = first(params.actor).trim().slice(0, 200);
  const action = first(params.action).trim();
  const outcome = first(params.outcome).trim();
  const from = first(params.from).trim();
  const to = first(params.to).trim();
  const targetType = first(params.targetType).trim();
  const target = first(params.target).trim().slice(0, 200);

  return {
    actor,
    action: isAction(action) ? action : '',
    outcome: isOutcome(outcome) ? outcome : '',
    from: isValidDateInput(from) ? from : '',
    to: isValidDateInput(to) ? to : '',
    targetType: isTargetType(targetType) ? targetType : '',
    target,
  };
}

export function parseAdminAuditPage(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(first(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function hasAdminAuditFilters(filters: AdminAuditFilters): boolean {
  return Boolean(
    filters.actor ||
      filters.action ||
      filters.outcome ||
      filters.from ||
      filters.to ||
      filters.targetType ||
      filters.target
  );
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function escapeOrValue(value: string): string {
  return value
    .replace(/[(),"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\\%_]/g, '\\$&');
}

function dateStart(value: string): string {
  return `${value}T00:00:00.000Z`;
}

function dateEnd(value: string): string {
  const end = new Date(`${value}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return new Date(end.getTime() - 1).toISOString();
}

function applyAdminAuditFilters(query: AuditQuery, filters: AdminAuditFilters): AuditQuery {
  let next = query;

  if (filters.actor) {
    next = isUuid(filters.actor)
      ? next.eq('actor_user_id', filters.actor)
      : next.ilike('actor_email', `%${escapeLike(filters.actor)}%`);
  }
  if (filters.action) next = next.eq('action', filters.action);
  if (filters.outcome) next = next.eq('outcome', filters.outcome);
  if (filters.from) next = next.gte('created_at', dateStart(filters.from));
  if (filters.to) next = next.lte('created_at', dateEnd(filters.to));
  if (filters.targetType) next = next.eq('target_type', filters.targetType);

  if (filters.target) {
    const term = escapeOrValue(filters.target);
    if (term) {
      const pattern = `%${term}%`;
      next = next.or(`target_id.ilike.${pattern},target_label.ilike.${pattern}`);
    }
  }

  return next;
}

export async function getAdminAuditPage(
  adminClient: unknown,
  filters: AdminAuditFilters,
  page: number
): Promise<AdminAuditPage> {
  const offset = (Math.max(1, page) - 1) * ADMIN_AUDIT_PAGE_SIZE;
  const db = asDatabase(adminClient);
  const query = applyAdminAuditFilters(
    db.from(ADMIN_AUDIT_TABLE).select(LIST_COLUMNS, { count: 'exact' }),
    filters
  );
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + ADMIN_AUDIT_PAGE_SIZE - 1);

  if (error) throw new AdminAuditReadError('load the audit log', error);

  const rows = (data as AdminAuditListRow[] | null) ?? [];
  return { rows, totalCount: count ?? rows.length };
}

export async function getAdminAuditOperation(
  adminClient: unknown,
  id: string
): Promise<AdminAuditOperation | null> {
  if (!isUuid(id)) return null;

  const db = asDatabase(adminClient);
  const { data, error } = await db
    .from(ADMIN_AUDIT_TABLE)
    .select(EXPORT_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new AdminAuditReadError('load that audit operation', error);
  return (data as AdminAuditOperation | null) ?? null;
}

async function getAdminAuditCount(
  adminClient: unknown,
  filters: AdminAuditFilters
): Promise<number> {
  const db = asDatabase(adminClient);
  const query = applyAdminAuditFilters(
    db.from(ADMIN_AUDIT_TABLE).select('id', { count: 'exact', head: true }),
    filters
  );
  const { error, count } = await query;
  if (error) throw new AdminAuditReadError('count the audit log', error);
  return count ?? 0;
}

export async function exportAdminAuditCsv(
  adminClient: unknown,
  filters: AdminAuditFilters
): Promise<string> {
  const totalCount = await getAdminAuditCount(adminClient, filters);
  if (totalCount > ADMIN_AUDIT_MAX_EXPORT_ROWS) {
    throw new AdminAuditExportTooLargeError(totalCount);
  }

  const db = asDatabase(adminClient);
  const rows: AdminAuditOperation[] = [];

  for (let offset = 0; offset < totalCount; offset += ADMIN_AUDIT_EXPORT_BATCH_SIZE) {
    const query = applyAdminAuditFilters(
      db.from(ADMIN_AUDIT_TABLE).select(EXPORT_COLUMNS),
      filters
    );
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + ADMIN_AUDIT_EXPORT_BATCH_SIZE - 1);
    if (error) throw new AdminAuditReadError('export the audit log', error);

    const batch = (data as AdminAuditOperation[] | null) ?? [];
    rows.push(...batch);
    if (batch.length < ADMIN_AUDIT_EXPORT_BATCH_SIZE) break;
  }

  return toAdminAuditCsv(rows);
}

function csvValue(value: unknown): string {
  let text = '';
  if (value !== null && value !== undefined) {
    if (typeof value === 'string') {
      text = value;
    } else {
      try {
        text = JSON.stringify(value) ?? '';
      } catch {
        text = '';
      }
    }
  }

  // Spreadsheet formula injection: an audit field is often admin-supplied, and
  // a leading =, +, -, @ or tab would be executed when the CSV opens in Excel.
  // Quoting alone does not prevent that; prefixing with an apostrophe does.
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Serialize all operation fields, including JSON snapshots, as RFC 4180 CSV. */
export function toAdminAuditCsv(rows: readonly AdminAuditOperation[]): string {
  const header = [
    'ID',
    'Created at (UTC)',
    'Actor user ID',
    'Actor email',
    'Action',
    'Action label',
    'Target type',
    'Target ID',
    'Target label',
    'MFA level',
    'Outcome',
    'Outcome label',
    'Error',
    'Before',
    'After',
    'Metadata',
  ];

  const lines = rows.map((row) =>
    [
      row.id,
      row.created_at,
      row.actor_user_id,
      row.actor_email,
      row.action,
      adminAuditActionLabel(row.action),
      row.target_type,
      row.target_id,
      adminAuditTargetTypeLabel(row.target_type),
      row.target_label,
      row.mfa_level,
      row.outcome,
      adminAuditOutcomeLabel(row.outcome),
      row.error,
      row.before,
      row.after,
      row.metadata,
    ]
      .map(csvValue)
      .join(',')
  );

  return `${header.join(',')}\r\n${lines.join('\r\n')}${lines.length > 0 ? '\r\n' : ''}`;
}

export function adminAuditActionLabel(action: string): string {
  return isAction(action) ? ADMIN_AUDIT_ACTION_LABELS[action] : action;
}

export function adminAuditTargetTypeLabel(targetType: string): string {
  return isTargetType(targetType) ? ADMIN_AUDIT_TARGET_TYPE_LABELS[targetType] : targetType;
}

export function adminAuditOutcomeLabel(outcome: string): string {
  return isOutcome(outcome) ? ADMIN_AUDIT_OUTCOME_LABELS[outcome] : outcome;
}

export function formatAdminAuditTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export function adminAuditHref(path: string, filters: AdminAuditFilters, page?: number): string {
  const params = new URLSearchParams();
  if (filters.actor) params.set('actor', filters.actor);
  if (filters.action) params.set('action', filters.action);
  if (filters.outcome) params.set('outcome', filters.outcome);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.targetType) params.set('targetType', filters.targetType);
  if (filters.target) params.set('target', filters.target);
  if (page && page > 1) params.set('page', String(page));

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
