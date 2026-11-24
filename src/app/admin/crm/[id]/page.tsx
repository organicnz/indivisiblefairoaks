import { notFound } from 'next/navigation';
import { CRMContactBulkChangesPanel } from '@/components/admin/crm/CRMContactBulkChangesPanel';
import { CRMDetailClient } from '@/components/admin/crm/CRMDetailClient';
import { getCRMContactDetail } from '@/lib/actions/crm';
import {
  ADMIN_AUDIT_CONTACT_BULK_PAGE_SIZE,
  getAdminAuditContactBulkChanges,
} from '@/lib/admin-audit-read';
import { requireAdminPage } from '@/lib/admin-auth';

// Deliberate Cache Components opt-out (Block): admin surface behind requireAdmin() session gate.
export const instant = false;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { contact } = await getCRMContactDetail(id);
    const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email;
    return {
      title: `${name} — Civic CRM · Indivisible Fair Oaks`,
      description: `Constituent profile, engagement timeline, and communication history for ${name}.`,
      robots: { index: false, follow: false },
    };
  } catch {
    return {
      title: 'Constituent Profile — Admin · Indivisible Fair Oaks',
      description: 'Constituent details in Civic CRM.',
      robots: { index: false, follow: false },
    };
  }
}

export default async function AdminCRMDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; bulkPage?: string }>;
}) {
  const { adminClient } = await requireAdminPage();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const activityPage = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const bulkPage = Math.max(1, parseInt(query.bulkPage || '1', 10) || 1);

  try {
    const [detail, bulkChanges] = await Promise.all([
      getCRMContactDetail(id, activityPage),
      getAdminAuditContactBulkChanges(adminClient, id, bulkPage).then(
        (result) => ({ ...result, unavailable: false }),
        () => ({ rows: [], totalCount: 0, unavailable: true })
      ),
    ]);
    const {
      contact,
      activities,
      tasks,
      activityPage: currentActivityPage,
      activityPageSize,
      activityCount,
      tasksTruncated,
      taskCount,
      openTaskCount,
    } = detail;
    return (
      <div className="space-y-6">
        <CRMDetailClient
          contact={contact}
          activities={activities}
          tasks={tasks}
          activityPage={currentActivityPage}
          activityPageSize={activityPageSize}
          activityCount={activityCount}
          tasksTruncated={tasksTruncated}
          taskCount={taskCount}
          openTaskCount={openTaskCount}
        />
        <CRMContactBulkChangesPanel
          contactId={contact.id}
          changes={bulkChanges.rows}
          page={bulkPage}
          pageSize={ADMIN_AUDIT_CONTACT_BULK_PAGE_SIZE}
          totalCount={bulkChanges.totalCount}
          unavailable={bulkChanges.unavailable}
          activityPage={currentActivityPage}
        />
      </div>
    );
  } catch {
    notFound();
  }
}
