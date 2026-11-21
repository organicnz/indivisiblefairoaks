import { AlertTriangle, CloudOff } from 'lucide-react';
import Link from 'next/link';
import type { AdminAuditOutboxHealth } from '@/lib/admin-audit-outbox';

export function AdminAuditOutboxAlert({
  health,
  error = false,
  linkToHealth = true,
}: {
  health: AdminAuditOutboxHealth | null;
  error?: boolean;
  linkToHealth?: boolean;
}) {
  if (error) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950"
      >
        <div className="flex items-start gap-3">
          <CloudOff size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold">Audit outbox health could not be checked</p>
            <p className="mt-1 leading-relaxed">
              The audit log may be behind and this page cannot prove otherwise.
              {linkToHealth ? (
                <>
                  {' '}
                  <Link
                    href="/admin/audit/outbox"
                    className="font-bold underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
                  >
                    Open outbox health
                  </Link>
                  .
                </>
              ) : null}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!health || health.severity === 'healthy') return null;

  const critical = health.severity === 'critical';
  const counts = [
    health.overdueCount > 0 ? `${health.overdueCount} overdue` : null,
    health.failingCount > 0 ? `${health.failingCount} repeatedly failing` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      role="alert"
      className={`rounded-2xl border px-5 py-4 text-sm ${
        critical
          ? 'border-rose-300 bg-rose-50 text-rose-950'
          : 'border-amber-300 bg-amber-50 text-amber-950'
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-bold">
            {critical ? 'Audit outbox delivery is failing' : 'Audit outbox is overdue'}
          </p>
          <p className="mt-1 leading-relaxed">
            {health.totalCount.toLocaleString('en-US')} queued audit{' '}
            {health.totalCount === 1 ? 'record' : 'records'}: {counts}.{' '}
            <Link
              href="/admin/audit/outbox"
              className={`font-bold underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 ${
                critical ? 'focus-visible:ring-rose-700' : 'focus-visible:ring-amber-700'
              }`}
            >
              Review outbox health
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
