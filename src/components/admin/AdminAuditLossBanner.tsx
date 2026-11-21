import { AlertOctagon, X } from 'lucide-react';
import Link from 'next/link';
import { acknowledgeAdminAuditLoss } from '@/app/admin/actions';
import { formatAdminAuditTimestamp } from '@/lib/admin-audit-read';

/**
 * Shown by the admin layout when an audit record reached neither the log nor the
 * outbox. Unlike a toast, this survives navigation; it is cleared by an
 * administrator's acknowledgement or when the marker cookie expires.
 */
export function AdminAuditLossBanner({ reportedAt }: { reportedAt: string }) {
  return (
    <div
      role="alert"
      className="mb-6 rounded-2xl border-2 border-rose-400 bg-rose-50 px-5 py-4 text-sm text-rose-950"
    >
      <div className="flex items-start gap-3">
        <AlertOctagon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">Audit trail incomplete</p>
          <p className="mt-1 leading-relaxed">
            An administrative operation&apos;s audit record could not be written to the audit log or
            queued for retry. The operation itself is not rolled back.{' '}
            <strong>Check the server diagnostics before retrying it.</strong>
          </p>
          <p className="mt-2 text-xs font-medium text-rose-900">
            Reported {formatAdminAuditTimestamp(reportedAt)}.{' '}
            <Link
              href="/admin/audit"
              className="font-bold underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700"
            >
              Open the audit log
            </Link>{' '}
            ·{' '}
            <Link
              href="/admin/audit/outbox"
              className="font-bold underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700"
            >
              Check outbox health
            </Link>
          </p>
        </div>
        <form action={acknowledgeAdminAuditLoss}>
          <button
            type="submit"
            aria-label="Acknowledge and dismiss audit warning"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-rose-300 bg-rose-100 text-rose-900 transition-colors hover:bg-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
}
