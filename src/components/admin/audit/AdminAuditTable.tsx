import { ChevronLeft, ChevronRight, Eye, ScrollText } from 'lucide-react';
import Link from 'next/link';
import {
  type AdminAuditFilters,
  type AdminAuditListRow,
  adminAuditActionLabel,
  adminAuditHref,
  adminAuditOutcomeLabel,
  adminAuditTargetTypeLabel,
  formatAdminAuditTimestamp,
  hasAdminAuditFilters,
} from '@/lib/admin-audit-read';

const OUTCOME_BADGE: Record<string, string> = {
  success: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  failure: 'border-red-300 bg-red-50 text-red-800',
  denied: 'border-amber-300 bg-amber-50 text-amber-900',
};

function actorLabel(row: AdminAuditListRow): string {
  return row.actor_email || row.actor_user_id;
}

function targetLabel(row: AdminAuditListRow): string {
  return row.target_label || row.target_id;
}

function PagerLink({
  href,
  children,
  label,
}: {
  href: string | null;
  children: React.ReactNode;
  label: string;
}) {
  if (!href) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border bg-surface-card px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {children}
    </Link>
  );
}

export function AdminAuditTable({
  rows,
  totalCount,
  filters,
  page,
  pageSize,
}: {
  rows: AdminAuditListRow[];
  totalCount: number;
  filters: AdminAuditFilters;
  page: number;
  pageSize: number;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const outOfRange = rows.length === 0 && totalCount > 0 && page > totalPages;
  const filtered = hasAdminAuditFilters(filters);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground">
            Recorded operations
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {totalCount.toLocaleString('en-US')} {totalCount === 1 ? 'operation' : 'operations'}
            {filtered ? ' matching these filters' : ''}
          </p>
        </div>
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Page {page} of {totalPages}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <ScrollText size={30} className="mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-muted-foreground">
            {outOfRange
              ? 'That page is out of range.'
              : filtered
                ? 'No operations match these filters.'
                : 'No audit operations have been recorded yet.'}
          </p>
          {outOfRange ? (
            <Link
              href={adminAuditHref('/admin/audit', filters, 1)}
              className="mt-3 inline-block text-sm font-semibold text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-on-dark"
            >
              Go to the first page
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[58rem] border-collapse text-left">
            <thead className="bg-surface-muted">
              <tr className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <th scope="col" className="px-4 py-3">
                  Time (UTC)
                </th>
                <th scope="col" className="px-4 py-3">
                  Actor
                </th>
                <th scope="col" className="px-4 py-3">
                  Action
                </th>
                <th scope="col" className="px-4 py-3">
                  Target
                </th>
                <th scope="col" className="px-4 py-3">
                  Outcome
                </th>
                <th scope="col" className="px-4 py-3">
                  MFA
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="align-top transition-colors hover:bg-surface-muted/50">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] text-muted-foreground">
                    <time dateTime={row.created_at}>
                      {formatAdminAuditTimestamp(row.created_at)}
                    </time>
                  </td>
                  <td className="max-w-[14rem] px-4 py-3 text-xs text-foreground">
                    <span className="block truncate font-medium" title={actorLabel(row)}>
                      {actorLabel(row)}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[9px] text-muted-foreground">
                      {row.actor_user_id}
                    </span>
                  </td>
                  <td className="max-w-[13rem] px-4 py-3 text-xs text-foreground">
                    <span className="block font-medium">{adminAuditActionLabel(row.action)}</span>
                    <span className="mt-0.5 block truncate font-mono text-[9px] text-muted-foreground">
                      {row.action}
                    </span>
                  </td>
                  <td className="max-w-[15rem] px-4 py-3 text-xs text-foreground">
                    <span className="block truncate font-medium" title={targetLabel(row)}>
                      {targetLabel(row)}
                    </span>
                    <span className="mt-0.5 block font-mono text-[9px] text-muted-foreground">
                      {adminAuditTargetTypeLabel(row.target_type)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        OUTCOME_BADGE[row.outcome] ??
                        'border-border bg-surface-muted text-muted-foreground'
                      }`}
                    >
                      {adminAuditOutcomeLabel(row.outcome)}
                    </span>
                    {row.error ? (
                      <span
                        className="mt-1 block max-w-[12rem] truncate text-[10px] text-destructive"
                        title={row.error}
                      >
                        {row.error}
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] uppercase text-muted-foreground">
                    {row.mfa_level}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/audit/${row.id}`}
                      aria-label={`View audit operation ${row.id}`}
                      className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Eye size={12} aria-hidden="true" />
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalCount > 0 ? (
        <nav
          aria-label="Audit log pages"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4"
        >
          <PagerLink
            href={page > 1 ? adminAuditHref('/admin/audit', filters, page - 1) : null}
            label="Previous audit page"
          >
            <ChevronLeft size={13} aria-hidden="true" />
            Previous
          </PagerLink>
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <PagerLink
            href={page < totalPages ? adminAuditHref('/admin/audit', filters, page + 1) : null}
            label="Next audit page"
          >
            Next
            <ChevronRight size={13} aria-hidden="true" />
          </PagerLink>
        </nav>
      ) : null}
    </section>
  );
}
