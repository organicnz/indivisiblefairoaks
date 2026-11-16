import { ExternalLink, ShieldAlert } from 'lucide-react';
import type { Metadata } from 'next';
import { IceReportModeration } from '@/components/admin/IceReportModeration';
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
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-white dark:bg-primary-bright">
              <ShieldAlert size={14} aria-hidden="true" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
              Private moderation
            </span>
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] text-foreground">
            ICE reports
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Raw reports are private. First review prepares a sanitized city-level draft; a
            different admin must approve it before anything appears publicly. Never copy names,
            plates, addresses, contact details, or exact locations into a draft.
          </p>
        </div>

        <a
          href="/ice-alerts#reviewed-reports"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 border border-border bg-surface-card px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          View public section
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </div>

      <div className="mb-5 grid gap-px border border-border bg-border sm:grid-cols-3">
        <div className="bg-surface-card p-4">
          <p className="font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Awaiting first review
          </p>
          <p className="mt-1 font-display text-3xl font-semibold tracking-[-0.03em]">
            {firstReview}
          </p>
        </div>
        <div className="bg-surface-card p-4">
          <p className="font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Awaiting second reviewer
          </p>
          <p className="mt-1 font-display text-3xl font-semibold tracking-[-0.03em]">
            {secondReview}
          </p>
        </div>
        <div className="bg-surface-card p-4">
          <p className="font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Retention window
          </p>
          <p className="mt-1 font-display text-3xl font-semibold tracking-[-0.03em]">30 days</p>
        </div>
      </div>

      <div className="mb-5 border border-accent/35 bg-accent/5 p-4 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Two-person rule:</strong> the admin who prepares the
        public draft cannot approve it. The database function re-checks this and writes only the
        allowlisted public fields. A report is not evidence of a crime or a verified sighting.
      </div>

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
