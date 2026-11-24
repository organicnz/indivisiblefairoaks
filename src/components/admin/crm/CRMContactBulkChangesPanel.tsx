import { History, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { CRMPager } from '@/components/admin/crm/CRMPager';
import {
  type AdminAuditOperation,
  adminAuditActionLabel,
  adminAuditOutcomeLabel,
  formatAdminAuditTimestamp,
} from '@/lib/admin-audit-read';
import { CRM_CONTACT_STATUS_OPTIONS } from '@/lib/crm-contact-options';
import { pageRange, totalPages } from '@/lib/crm-filters';

const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  district: 'District',
  tags: 'Tags',
  consent: 'Email consent',
};

const STATUS_LABELS = new Map(
  CRM_CONTACT_STATUS_OPTIONS.map((option) => [option.value as string, option.label])
);

const OUTCOME_BADGE: Record<string, string> = {
  success: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  failure: 'border-red-300 bg-red-50 text-red-800',
  denied: 'border-amber-300 bg-amber-50 text-amber-900',
};

type JsonRecord = Record<string, unknown>;

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

function metadata(operation: AdminAuditOperation): JsonRecord {
  return record(operation.metadata) ?? {};
}

function contactSnapshot(
  operation: AdminAuditOperation,
  side: 'before' | 'after',
  contactId: string
): JsonRecord | null {
  const snapshot = record(operation[side]);
  return recordArray(snapshot?.contacts).find((contact) => contact.id === contactId) ?? null;
}

function affectedIds(operation: AdminAuditOperation): string[] {
  const stored = metadata(operation);
  // An explicitly empty affected_ids means nothing changed. Only fall back to
  // the before snapshot when an older operation predates that field.
  if (Object.hasOwn(stored, 'affected_ids')) return stringArray(stored.affected_ids);
  return stringArray(record(operation.before)?.contact_ids);
}

function changedFields(operation: AdminAuditOperation): string[] {
  const stored = stringArray(metadata(operation).changed_fields).filter((field) =>
    Object.hasOwn(FIELD_LABELS, field)
  );
  if (stored.length > 0) return stored;

  const before = record(operation.before);
  const after = record(operation.after);
  return Object.keys(FIELD_LABELS).filter((field) => {
    if (field === 'consent') {
      return (
        Object.hasOwn(before ?? {}, 'do_not_email') || Object.hasOwn(after ?? {}, 'do_not_email')
      );
    }
    return Object.hasOwn(before ?? {}, field) || Object.hasOwn(after ?? {}, field);
  });
}

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function valueLabel(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not set';
  return String(value);
}

function statusLabel(value: unknown): string {
  return typeof value === 'string'
    ? (STATUS_LABELS.get(value) ?? value.replaceAll('_', ' '))
    : 'Not set';
}

function consentLabel(value: unknown): string {
  if (value === true) return 'Opted out';
  if (value === false) return 'Opted in';
  return 'Never asked';
}

function fieldChange(
  field: string,
  before: JsonRecord | null,
  after: JsonRecord | null
): string | null {
  if (!before || !after) return null;

  if (field === 'status') {
    const beforeLabel = statusLabel(before.status);
    const afterLabel = statusLabel(after.status);
    return beforeLabel === afterLabel ? null : `${beforeLabel} → ${afterLabel}`;
  }
  if (field === 'district') {
    if ((before.district ?? '') === (after.district ?? '')) return null;
    return `${valueLabel(before.district)} → ${valueLabel(after.district)}`;
  }
  if (field === 'consent') {
    const beforeConsent = before.do_not_email ?? null;
    const afterConsent = after.do_not_email ?? null;
    if (beforeConsent === afterConsent) return null;
    return `${consentLabel(beforeConsent)} → ${consentLabel(afterConsent)}`;
  }
  if (field === 'tags') {
    const beforeTags = stringArray(before.tags);
    const afterTags = stringArray(after.tags);
    const added = afterTags.filter((tag) => !beforeTags.includes(tag));
    const removed = beforeTags.filter((tag) => !afterTags.includes(tag));
    if (added.length === 0 && removed.length === 0) return null;
    return [...added.map((tag) => `+#${tag}`), ...removed.map((tag) => `-#${tag}`)].join(' ');
  }

  return null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function CRMContactBulkChangesPanel({
  contactId,
  changes,
  page,
  pageSize,
  totalCount,
  unavailable,
  activityPage,
}: {
  contactId: string;
  changes: AdminAuditOperation[];
  page: number;
  pageSize: number;
  totalCount: number;
  /** The audit table could not be read; do not present an empty history as fact. */
  unavailable: boolean;
  /** Preserve the timeline page while paging this panel. */
  activityPage: number;
}) {
  const total = totalPages(totalCount, pageSize);
  const pagerPage = Math.min(page, total);
  const outOfRange = changes.length === 0 && totalCount > 0 && page > total;
  const [firstRow, lastRow] = pageRange(pagerPage, pageSize, totalCount);
  const pagerParams = activityPage > 1 ? { page: String(activityPage) } : undefined;
  const firstPageHref =
    activityPage > 1
      ? `/admin/crm/${encodeURIComponent(contactId)}?page=${activityPage}`
      : `/admin/crm/${encodeURIComponent(contactId)}`;

  return (
    <section
      aria-labelledby="bulk-change-history-heading"
      className="overflow-hidden rounded-2xl border border-border bg-surface-card shadow-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <History
              size={16}
              className="text-primary dark:text-primary-on-dark"
              aria-hidden="true"
            />
            <h2
              id="bulk-change-history-heading"
              className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground"
            >
              Bulk change history
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {unavailable
              ? 'Bulk changes could not be loaded.'
              : `${totalCount.toLocaleString('en-US')} ${
                  totalCount === 1 ? 'bulk update selected' : 'bulk updates selected'
                } this constituent.`}
          </p>
        </div>
        <Link
          href={`/admin/audit?contact=${encodeURIComponent(contactId)}`}
          className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Open in audit log
        </Link>
      </div>

      {unavailable ? (
        <div
          role="alert"
          className="flex items-start gap-3 border-b border-border bg-amber-50/60 px-5 py-4 text-sm text-amber-900"
        >
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
          <p>
            Bulk change history is temporarily unavailable. The rest of the profile is unaffected.
          </p>
        </div>
      ) : changes.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <History size={28} className="mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-muted-foreground">
            {outOfRange
              ? 'That page is out of range.'
              : totalCount === 0
                ? 'This constituent has not been included in a bulk update.'
                : 'No bulk changes on this page.'}
          </p>
          {outOfRange ? (
            <Link
              href={firstPageHref}
              className="mt-3 inline-block text-sm font-semibold text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-on-dark"
            >
              Go to the first page
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {changes.map((change) => {
            const affected = affectedIds(change).includes(contactId);
            const fields = changedFields(change);
            const before = contactSnapshot(change, 'before', contactId);
            const after = contactSnapshot(change, 'after', contactId);
            const details = fields.flatMap((field) => {
              const value = fieldChange(field, before, after);
              return value ? [{ field, value }] : [];
            });
            const requestedCount = numberValue(metadata(change).requested_count);
            const affectedCount = numberValue(metadata(change).affected_count);
            const changed = affected && details.length > 0;
            const hasSnapshots = before !== null && after !== null;
            const scope =
              requestedCount === null
                ? change.target_label
                : `${requestedCount.toLocaleString('en-US')} selected${
                    affectedCount === null
                      ? ''
                      : ` · ${affectedCount.toLocaleString('en-US')} affected`
                  }`;

            return (
              <article key={change.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/audit/${change.id}`}
                    className="text-sm font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {adminAuditActionLabel(change.action)}
                  </Link>
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                      OUTCOME_BADGE[change.outcome] ??
                      'border-border bg-surface-muted text-muted-foreground'
                    }`}
                  >
                    {adminAuditOutcomeLabel(change.outcome)}
                  </span>
                </div>

                <p className="mt-1 text-[11px] text-muted-foreground">
                  <time dateTime={change.created_at}>
                    {formatAdminAuditTimestamp(change.created_at)}
                  </time>
                  {' · '}
                  {change.actor_email || change.actor_user_id}
                </p>

                <p className="mt-2 text-xs text-foreground">
                  {scope ? <span>{scope}. </span> : null}
                  {change.outcome !== 'success'
                    ? 'The operation did not complete.'
                    : changed
                      ? 'This constituent was changed.'
                      : affected && !hasSnapshots
                        ? 'This constituent was affected; field details were not recorded.'
                        : 'This constituent was selected but no change was recorded.'}
                </p>

                {details.length > 0 ? (
                  <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                    {details.map(({ field, value }) => (
                      <div key={field} className="flex min-w-0 gap-1.5">
                        <dt className="shrink-0 font-medium text-muted-foreground">
                          {fieldLabel(field)}:
                        </dt>
                        <dd className="min-w-0 break-words text-foreground">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : fields.length > 0 && !hasSnapshots ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {fields.map((field) => (
                      <span
                        key={field}
                        className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        {fieldLabel(field)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {!unavailable && totalCount > 0 && !outOfRange ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
          <p className="text-xs text-muted-foreground">
            Showing{' '}
            <strong className="font-semibold text-foreground">
              {firstRow}–{lastRow}
            </strong>{' '}
            of <strong className="font-semibold text-foreground">{totalCount}</strong> bulk changes.
          </p>
          <CRMPager
            page={pagerPage}
            totalCount={totalCount}
            pageSize={pageSize}
            basePath={`/admin/crm/${contactId}`}
            params={pagerParams}
            pageParam="bulkPage"
            ariaLabel="Bulk change history pages"
          />
        </div>
      ) : null}
    </section>
  );
}
