import type { Metadata } from 'next';
import { AdminNotice } from '@/components/admin/AdminNotice';
import { AdminStatGrid } from '@/components/admin/AdminStatGrid';
import { IceReportModeration } from '@/components/admin/IceReportModeration';
import { IceReportsHeader } from '@/components/admin/ice/IceReportsHeader';
import { requireAdminPage } from '@/lib/admin-auth';
import { listIceReportQueue, type IceReportStore } from '@/lib/ice-report-intake';
import type { IceReportIntakeRow } from '@/lib/ice-report-shared';

// Deliberate Cache Components opt-out: the queue is private and request-time.
export const instant = false;

export const metadata: Metadata = {
  title: 'ICE Reports — Admin · Indivisible Fair Oaks',
  robots: { index: false, follow: false },
};

export default async function AdminIceReportsPage() {
  const { adminClient, adminUserId } = await requireAdminPage('/admin/ice-reports');
  let reports: IceReportIntakeRow[] = [];
  let loadError = false;

  try {
    reports = await listIceReportQueue(adminClient as unknown as IceReportStore);
  } catch {
    loadError = true;
  }

  const firstReview = reports.filter((report) => report.status === 'received').length;
  const secondReview = reports.length - firstReview;

  return (
    <div>
      <IceReportsHeader />

      <AdminStatGrid
        stats={[
          { label: 'Awaiting first review', value: firstReview },
          { label: 'Awaiting second reviewer', value: secondReview },
          { label: 'Retention window', value: '30 days' },
        ]}
      />

      <AdminNotice>
        <strong className="text-foreground">Two-person rule for this queue:</strong> the admin who
        prepares a held report&apos;s public draft cannot approve it. The database function re-checks
        this and writes only the allowlisted public fields. Automatic entries are generated
        city-level summaries, never raw text. A report is not evidence of a crime or a verified
        sighting.
      </AdminNotice>

      {loadError ? (
        <div role="alert" className="border border-accent/40 bg-accent/10 p-5 text-sm">
          The private report queue could not be loaded. Check the database migration and try again.
        </div>
      ) : (
        <IceReportModeration reports={reports} currentAdminId={adminUserId} />
      )}
    </div>
  );
}
