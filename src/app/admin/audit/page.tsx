import { History } from 'lucide-react';
import type { Metadata } from 'next';
import { AdminNotice } from '@/components/admin/AdminNotice';
import { AdminAuditFilters } from '@/components/admin/audit/AdminAuditFilters';
import { AdminAuditTable } from '@/components/admin/audit/AdminAuditTable';
import {
  ADMIN_AUDIT_PAGE_SIZE,
  type AdminAuditPage,
  getAdminAuditPage,
  parseAdminAuditFilters,
  parseAdminAuditPage,
} from '@/lib/admin-audit-read';
import { requireAdminPage } from '@/lib/admin-auth';

// Deliberate Cache Components opt-out: private audit data behind requireAdmin().
export const instant = false;

export const metadata: Metadata = {
  title: 'Audit log — Admin · Indivisible Fair Oaks',
  description: 'Read-only records of privileged admin operations.',
  robots: { index: false, follow: false },
};

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { adminClient } = await requireAdminPage('/admin/audit');
  const params = await searchParams;
  const filters = parseAdminAuditFilters(params);
  const page = parseAdminAuditPage(params.page);

  let result: AdminAuditPage = { rows: [], totalCount: 0 };
  let loadError = false;
  try {
    result = await getAdminAuditPage(adminClient, filters, page);
  } catch {
    loadError = true;
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-border pb-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-white dark:bg-primary-bright">
            <History size={17} aria-hidden="true" />
          </span>
          <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
            Private accountability
          </span>
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
          Audit log
        </h1>
        <div className="mt-3 h-1.5 w-24 bg-primary" />
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A read-only record of privileged admin mutations: who acted, what changed, the target, the
          MFA level of the session, and whether the operation succeeded. Use the filters to
          reconstruct an operation or export the matching rows for an external review.
        </p>
      </header>

      <AdminNotice>
        <strong className="text-foreground">Append-only.</strong> These records cannot be edited or
        deleted from this explorer or by the service role. Bulk CRM audit writes that could not
        reach this log are delivered from the durable outbox automatically.
      </AdminNotice>

      <AdminAuditFilters filters={filters} />

      {loadError ? (
        <div
          role="alert"
          className="rounded-2xl border border-accent/40 bg-accent/10 px-5 py-4 text-sm text-foreground"
        >
          The audit log could not be loaded. Check the database migration and try again.
        </div>
      ) : (
        <AdminAuditTable
          rows={result.rows}
          totalCount={result.totalCount}
          filters={filters}
          page={page}
          pageSize={ADMIN_AUDIT_PAGE_SIZE}
        />
      )}
    </div>
  );
}
