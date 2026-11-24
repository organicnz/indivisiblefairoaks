import type { AdminAuditOperation } from '@/lib/admin-audit-read';
import { CRM_CONTACT_STATUS_OPTIONS } from '@/lib/crm-contact-options';

/**
 * Structured evidence for the two contact bulk operations.
 *
 * The audit writer records one operation-level row: requested/affected/updated
 * counts in `metadata`, and per-contact before/after snapshots in the JSONB
 * columns. This module turns that shape into counts and field-level diffs for
 * the audit detail. It never treats a missing count as zero unless the writer's
 * own omission means zero (an omitted affected count after a requested count).
 */

const BULK_ACTIONS = new Set(['crm.contact.bulk_update', 'crm.contact.bulk_delete']);

type BulkAction = 'crm.contact.bulk_update' | 'crm.contact.bulk_delete';

const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  district: 'District',
  tags: 'Tags',
  do_not_email: 'Email consent',
  unsubscribed_at: 'Unsubscribed at',
  email: 'Email',
  first_name: 'First name',
  last_name: 'Last name',
  deleted: 'Deleted',
};

const FIELD_ORDER = Object.keys(FIELD_LABELS);

const IDENTITY_FIELDS = new Set(['email', 'first_name', 'last_name']);

/** The bulk writer names the consent field `consent`; rows and diffs use `do_not_email`. */
const CHANGED_FIELD_ALIASES: Record<string, string> = {
  consent: 'do_not_email',
};

const STATUS_LABELS = new Map(
  CRM_CONTACT_STATUS_OPTIONS.map((option) => [option.value as string, option.label])
);

type JsonRecord = Record<string, unknown>;

export interface AdminAuditBulkFieldDiff {
  key: string;
  label: string;
  before: string;
  after: string;
}

export interface AdminAuditBulkContactDiff {
  id: string;
  name: string | null;
  email: string | null;
  deleted: boolean;
  fields: AdminAuditBulkFieldDiff[];
}

export interface AdminAuditBulkEvidence {
  action: BulkAction;
  requested: number | null;
  affected: number | null;
  updated: number | null;
  notAffected: number | null;
  updatedLabel: 'Updated' | 'Deleted';
  /** Deduplicated requested ids, in the order the writer recorded them. */
  requestedIds: string[] | null;
  /** Deduplicated affected ids, or the snapshot ids when the writer omitted them. */
  affectedIds: string[] | null;
  /** Field keys from metadata, falling back to keys present in the snapshots. */
  changedFields: string[] | null;
  contacts: AdminAuditBulkContactDiff[];
}

function record(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function recordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const item = record(entry);
        return item ? [item] : [];
      })
    : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function normalizedStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const normalized = entry.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function normalizedChangedFields(value: unknown): string[] | null {
  const fields = normalizedStringArray(value);
  if (fields === null) return null;

  const seen = new Set<string>();
  const out: string[] = [];
  for (const field of fields) {
    const normalized = CHANGED_FIELD_ALIASES[field] ?? field;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function snapshot(value: unknown): JsonRecord[] {
  return recordArray(record(value)?.contacts);
}

function contactMap(contacts: JsonRecord[]): Map<string, JsonRecord> {
  const map = new Map<string, JsonRecord>();
  for (const contact of contacts) {
    if (typeof contact.id === 'string' && contact.id && !map.has(contact.id)) {
      map.set(contact.id, contact);
    }
  }
  return map;
}

function fieldLabel(key: string): string {
  const label = FIELD_LABELS[key] ?? key.replaceAll('_', ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function statusLabel(value: unknown): string {
  if (typeof value !== 'string') return value === null ? 'None' : 'Not recorded';
  return STATUS_LABELS.get(value) ?? value.replaceAll('_', ' ');
}

function fieldValue(key: string, value: unknown, present: boolean): string {
  if (key === 'deleted') return value === true ? 'Yes' : 'No';
  if (!present) return 'Not recorded';

  if (key === 'do_not_email') {
    if (value === true) return 'Opted out';
    if (value === false) return 'Opted in';
    return 'Never asked';
  }
  if (key === 'tags') {
    const tags = stringArray(value);
    return tags.length > 0 ? tags.map((tag) => `#${tag}`).join(', ') : 'No tags';
  }
  if (key === 'status') return statusLabel(value);

  if (value === null || value === undefined) return 'None';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value === '' ? 'Empty' : value;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (Array.isArray(value)) {
    return value.length > 0
      ? value.map((entry) => JSON.stringify(entry) ?? '').join(', ')
      : 'Empty list';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value) ?? 'None';
    } catch {
      return 'Unreadable value';
    }
  }
  return String(value);
}

/** Tags are sets for evidence purposes; their order is not a change. */
function comparableValue(key: string, value: unknown): string {
  if (key === 'tags') return [...stringArray(value)].sort().join('\u0000');
  return JSON.stringify(value) ?? '';
}

function valuesDiffer(
  key: string,
  beforePresent: boolean,
  before: unknown,
  afterPresent: boolean,
  after: unknown
): boolean {
  if (beforePresent !== afterPresent) return true;
  if (!beforePresent) return false;
  if (key === 'do_not_email') return (before ?? null) !== (after ?? null);
  return comparableValue(key, before) !== comparableValue(key, after);
}

function contactIdentity(
  before: JsonRecord | null,
  after: JsonRecord | null
): { name: string | null; email: string | null } {
  // A deleted contact's after-snapshot contains only its id and `deleted: true`,
  // so prefer the pre-delete row for the human-readable identity.
  const source = after?.deleted === true ? before : (after ?? before);
  const first = text(source?.first_name);
  const last = text(source?.last_name);
  const name = [first, last].filter(Boolean).join(' ') || null;
  return { name, email: text(source?.email) };
}

function contactDiff(
  id: string,
  before: JsonRecord | null,
  after: JsonRecord | null
): AdminAuditBulkContactDiff {
  const deleted = after?.deleted === true;
  const keys = new Set<string>([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  keys.delete('id');

  const orderedKeys = [...FIELD_ORDER.filter((key) => keys.delete(key)), ...[...keys].sort()];

  const fields: AdminAuditBulkFieldDiff[] = [];
  for (const key of orderedKeys) {
    if (deleted && IDENTITY_FIELDS.has(key)) continue;

    const beforePresent = Boolean(before && Object.hasOwn(before, key));
    const afterPresent = Boolean(after && Object.hasOwn(after, key));
    if (!beforePresent && !afterPresent) continue;
    if (!valuesDiffer(key, beforePresent, before?.[key], afterPresent, after?.[key])) {
      continue;
    }

    fields.push({
      key,
      label: fieldLabel(key),
      before: fieldValue(key, before?.[key], beforePresent),
      after: fieldValue(key, after?.[key], afterPresent),
    });
  }

  const identity = contactIdentity(before, after);
  return { id, name: identity.name, email: identity.email, deleted, fields };
}

export function parseAdminAuditBulkEvidence(
  operation: AdminAuditOperation
): AdminAuditBulkEvidence | null {
  if (!BULK_ACTIONS.has(operation.action)) return null;

  const action = operation.action as BulkAction;
  const metadata = record(operation.metadata) ?? {};
  const beforeById = contactMap(snapshot(operation.before));
  const afterById = contactMap(snapshot(operation.after));

  const requestedIds = normalizedStringArray(metadata.requested_ids);
  const requested =
    integer(metadata.requested_count) ?? (requestedIds !== null ? requestedIds.length : null);

  const snapshotIds = new Set([...beforeById.keys(), ...afterById.keys()]);
  const snapshotIdList = [...snapshotIds];
  const affectedCount = integer(metadata.affected_count);
  const affectedIds =
    normalizedStringArray(metadata.affected_ids) ??
    (snapshotIdList.length > 0
      ? snapshotIdList
      : affectedCount === 0 || (affectedCount === null && requested !== null)
        ? []
        : null);
  const affected =
    affectedCount ??
    (affectedIds !== null
      ? affectedIds.length
      : snapshotIdList.length > 0
        ? snapshotIdList.length
        : requested !== null
          ? 0
          : null);

  const updated =
    action === 'crm.contact.bulk_delete'
      ? integer(metadata.deleted_count)
      : integer(metadata.updated_count);

  const notAffected =
    requested !== null && affected !== null && requested >= affected ? requested - affected : null;

  const requestedOrder = requestedIds ?? [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const id of requestedOrder) {
    if (snapshotIds.has(id) && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  for (const id of snapshotIdList) {
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  const contacts = ids.map((id) =>
    contactDiff(id, beforeById.get(id) ?? null, afterById.get(id) ?? null)
  );
  const changedFields =
    normalizedChangedFields(metadata.changed_fields) ??
    (contacts.length > 0
      ? [...new Set(contacts.flatMap((contact) => contact.fields.map((field) => field.key)))]
      : null);

  return {
    action,
    requested,
    affected,
    updated,
    notAffected,
    updatedLabel: action === 'crm.contact.bulk_delete' ? 'Deleted' : 'Updated',
    requestedIds,
    affectedIds,
    changedFields,
    contacts,
  };
}
