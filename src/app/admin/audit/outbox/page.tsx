import { Activity, ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminAuditOutboxAlert } from '@/components/admin/audit/AdminAuditOutboxAlert';
import { AdminAuditOutboxHealthView } from '@/components/admin/audit/AdminAuditOutboxHealthView';
import { type AdminAuditOutboxHealth, getAdminAuditOutboxHealth } from '@/lib/admin-audit-outbox';
import { requireAdminPage } from '@/lib/admin-auth';

// Deliberate Cache Components opt-out: private operational data behind requireAdmin().
export const instant = false;

export const metadata: Metadata = {
  title: 'Audit outbox health — Admin · Indivisible Fair Oaks',
  description: 'Retry state for audit records waiting to reach the append-only log.',
  robots: { index: false, follow: false },
};

export default async function AdminAuditOutboxPage() {
  const { adminClient } = await requireAdminPage('/admin/audit/outbox');

  let health: AdminAuditOutboxHealth | null = null;
  let loadError = false;
  try {
    health = await getAdminAuditOutboxHealth(adminClient);
  } catch {
    loadError = true;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/audit"
        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-on-dark"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        Back to audit log
      </Link>

      <header className="border-b border-border pb-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-white dark:bg-primary-bright">
            <Activity size={17} aria-hidden="true" />
          </span>
          <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
            Durable audit delivery
          </span>
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
          Audit outbox health
        </h1>
        <div className="mt-3 h-1.5 w-24 bg-primary" />
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Audit writes that could not reach the append-only log are preserved here and retried every
          minute. This view shows the records that are waiting, their retry state, and the failures
          that need an operator.
        </p>
      </header>

      {loadError ? (
        <AdminAuditOutboxAlert health={null} error linkToHealth={false} />
      ) : health ? (
        <AdminAuditOutboxHealthView health={health} />
      ) : null}
    </div>
  );
}
