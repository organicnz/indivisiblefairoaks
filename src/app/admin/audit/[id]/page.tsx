import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdminAuditDetail } from '@/components/admin/audit/AdminAuditDetail';
import { type AdminAuditOperation, getAdminAuditOperation } from '@/lib/admin-audit-read';
import { requireAdminPage } from '@/lib/admin-auth';
import { getDirectEmailDelivery, resendIdFromSnapshot } from '@/lib/crm-direct-email-delivery';
import type { DirectEmailDelivery } from '@/types/crm';

// Deliberate Cache Components opt-out: private audit data behind requireAdmin().
export const instant = false;

export const metadata: Metadata = {
  title: 'Audit operation — Admin · Indivisible Fair Oaks',
  description: 'Detail for one privileged admin operation.',
  robots: { index: false, follow: false },
};

export default async function AdminAuditOperationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { adminClient } = await requireAdminPage(`/admin/audit/${id}`);

  let operation: AdminAuditOperation | null;
  try {
    operation = await getAdminAuditOperation(adminClient, id);
  } catch {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-accent/40 bg-accent/10 px-5 py-4 text-sm text-foreground"
      >
        That audit operation could not be loaded. Try again from the audit log.
      </div>
    );
  }

  if (!operation) notFound();

  let delivery: DirectEmailDelivery | null = null;
  if (operation.action === 'crm.direct_email.send' && operation.outcome === 'success') {
    const providerId = resendIdFromSnapshot(operation.after);
    if (providerId) {
      try {
        delivery = await getDirectEmailDelivery(adminClient, {
          contactId: operation.target_id,
          providerId,
          acceptedAt: operation.created_at,
        });
      } catch {
        // The audit record is complete without the supplementary event read.
        delivery = null;
      }
    }
  }

  return <AdminAuditDetail operation={operation} delivery={delivery} />;
}
