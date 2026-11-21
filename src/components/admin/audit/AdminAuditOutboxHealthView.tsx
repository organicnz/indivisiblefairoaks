import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react';
import {
  ADMIN_AUDIT_OUTBOX_FAILING_ATTEMPTS,
  ADMIN_AUDIT_OUTBOX_OVERDUE_GRACE_MS,
  type AdminAuditOutboxHealth,
  isAdminAuditOutboxRowFailing,
  isAdminAuditOutboxRowOverdue,
} from '@/lib/admin-audit-outbox';
import {
  adminAuditActionLabel,
  adminAuditOutcomeLabel,
  adminAuditTargetTypeLabel,
  formatAdminAuditTimestamp,
} from '@/lib/admin-audit-read';

const OUTCOME_BADGE: Record<string, string> = {
  success: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  failure: 'border-red-300 bg-red-50 text-red-800',
  denied: 'border-amber-300 bg-amber-50 text-amber-900',
};

function CountCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone: 'neutral' | 'warning' | 'critical';
}) {
  const valueClass =
    tone === 'critical'
      ? 'text-rose-700'
      : tone === 'warning'
        ? 'text-amber-700'
        : 'text-foreground';
  return (
    <div className="rounded-2xl border border-border bg-surface-card p-4 shadow-xs">
      <dt className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-1 font-display text-3xl font-semibold tracking-[-0.03em] ${valueClass}`}>
        {value.toLocaleString('en-US')}
      </dd>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}

export function AdminAuditOutboxHealthView({ health }: { health: AdminAuditOutboxHealth }) {
  const critical = health.severity === 'critical';
  const warning = health.severity === 'warning';
  const overdueMinutes = Math.round(ADMIN_AUDIT_OUTBOX_OVERDUE_GRACE_MS / 60_000);

  return (
    <div className="space-y-5">
      <div
        role={health.severity === 'healthy' ? 'status' : 'alert'}
        className={`rounded-2xl border px-5 py-4 text-sm ${
          critical
            ? 'border-rose-300 bg-rose-50 text-rose-950'
            : warning
              ? 'border-amber-300 bg-amber-50 text-amber-950'
              : 'border-emerald-300 bg-emerald-50 text-emerald-950'
        }`}
      >
        <div className="flex items-start gap-3">
          {health.severity === 'healthy' ? (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          )}
          <div>
            <p className="font-bold">
              {critical
                ? 'Delivery is failing repeatedly'
                : warning
                  ? 'Delivery is overdue'
                  : 'The outbox is healthy'}
            </p>
            <p className="mt-1 leading-relaxed">
              {health.totalCount === 0
                ? 'No audit records are waiting to be delivered.'
                : health.severity === 'healthy'
                  ? `${health.totalCount.toLocaleString('en-US')} queued audit ${
                      health.totalCount === 1 ? 'record is' : 'records are'
                    } within the normal retry window.`
                  : health.failingCount > 0
                    ? `${health.failingCount.toLocaleString('en-US')} repeatedly failing${
                        health.overdueCount > 0
                          ? ` and ${health.overdueCount.toLocaleString('en-US')} overdue`
                          : ''
                      }. Only the audit delivery is retried; the original operation is not.`
                    : `${health.overdueCount.toLocaleString('en-US')} overdue. Only the audit delivery is retried; the original operation is not.`}
            </p>
          </div>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <CountCard
          label="Queued"
          value={health.totalCount}
          detail="Waiting for the once-a-minute delivery job."
          tone="neutral"
        />
        <CountCard
          label="Overdue"
          value={health.overdueCount}
          detail={`Next retry more than ${overdueMinutes} minutes late.`}
          tone={health.overdueCount > 0 ? 'warning' : 'neutral'}
        />
        <CountCard
          label="Repeatedly failing"
          value={health.failingCount}
          detail={`${ADMIN_AUDIT_OUTBOX_FAILING_ATTEMPTS}+ failed delivery attempts.`}
          tone={health.failingCount > 0 ? 'critical' : 'neutral'}
        />
      </dl>

      <p className="text-xs leading-relaxed text-muted-foreground">
        pg_cron retries due rows every minute. A failed delivery keeps the complete payload and
        backs off from 30 seconds up to one hour; nothing is deleted until the audit log insert
        succeeds. This view is read-only.
      </p>

      {health.rows.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-surface-card shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground">
                Queued records
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {health.totalCount.toLocaleString('en-US')} total, most failed first, then oldest
                retry
              </p>
            </div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Checked {formatAdminAuditTimestamp(health.checkedAt)}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[64rem] border-collapse text-left">
              <thead className="bg-surface-muted">
                <tr className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  <th scope="col" className="px-4 py-3">
                    Created (UTC)
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Audit record
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Outcome
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Attempts
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Next attempt
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Last error
                  </th>
                  <th scope="col" className="px-4 py-3">
                    ID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {health.rows.map((row) => {
                  const overdue = isAdminAuditOutboxRowOverdue(row, health.checkedAt);
                  const failing = isAdminAuditOutboxRowFailing(row);
                  return (
                    <tr
                      key={row.id}
                      className="align-top transition-colors hover:bg-surface-muted/50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] text-muted-foreground">
                        <time dateTime={row.created_at}>
                          {formatAdminAuditTimestamp(row.created_at)}
                        </time>
                      </td>
                      <td className="max-w-[20rem] px-4 py-3 text-xs text-foreground">
                        <span className="block font-medium">
                          {row.action ? adminAuditActionLabel(row.action) : 'Unknown action'}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                          {row.target_type
                            ? adminAuditTargetTypeLabel(row.target_type)
                            : 'Unknown target'}
                          {row.target_label || row.target_id
                            ? ` · ${row.target_label || row.target_id}`
                            : ''}
                        </span>
                        {row.actor_email ? (
                          <span className="mt-0.5 block truncate font-mono text-[9px] text-muted-foreground">
                            {row.actor_email}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                            OUTCOME_BADGE[row.outcome ?? ''] ??
                            'border-border bg-surface-muted text-muted-foreground'
                          }`}
                        >
                          {adminAuditOutcomeLabel(row.outcome ?? 'unknown')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-foreground">
                          {row.attempts}
                        </span>
                        {failing ? (
                          <span className="mt-1 block text-[9px] font-black uppercase tracking-wider text-rose-700">
                            Repeatedly failing
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[10px]">
                        <time
                          dateTime={row.next_attempt_at}
                          className={overdue ? 'font-bold text-rose-700' : 'text-muted-foreground'}
                        >
                          {formatAdminAuditTimestamp(row.next_attempt_at)}
                        </time>
                        {overdue ? (
                          <span className="mt-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-rose-700">
                            <Clock3 size={10} aria-hidden="true" />
                            Overdue
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-[18rem] px-4 py-3 text-[10px] text-muted-foreground">
                        {row.last_error ? (
                          <span
                            className="block max-w-[18rem] whitespace-pre-wrap break-words"
                            title={row.last_error}
                          >
                            {row.last_error}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="max-w-[12rem] px-4 py-3">
                        <code
                          className="block truncate font-mono text-[10px] text-muted-foreground"
                          title={row.id}
                        >
                          {row.id}
                        </code>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {health.totalCount > health.rows.length ? (
            <p className="border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
              Showing {health.rows.length.toLocaleString('en-US')} of{' '}
              {health.totalCount.toLocaleString('en-US')} queued records, most failed first. The
              counts above cover the entire outbox.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
