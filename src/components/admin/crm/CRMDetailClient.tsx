'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { CRMContactProfileCard } from '@/components/admin/crm/CRMContactProfileCard';
import { CRMContactWorkspace } from '@/components/admin/crm/CRMContactWorkspace';
import type { CRMActivityWithDelivery, CRMContact, CRMTask } from '@/types/crm';

interface Props {
  contact: CRMContact;
  activities: CRMActivityWithDelivery[];
  tasks: CRMTask[];
  /** The timeline page represented by `activities`. */
  activityPage: number;
  activityPageSize: number;
  /** Every activity on record; later pages hold fewer than this. */
  activityCount: number;
  /** True when the server cut `tasks` at its cap. */
  tasksTruncated: boolean;
  /** Every task on record, which is more than `tasks.length` when truncated. */
  taskCount: number;
  /** Open tasks on record — the tab label counts open, not total. */
  openTaskCount: number;
}

export function CRMDetailClient({
  contact,
  activities,
  tasks,
  activityPage,
  activityPageSize,
  activityCount,
  tasksTruncated,
  taskCount,
  openTaskCount,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/admin/crm"
          className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-muted-foreground hover:text-primary dark:hover:text-primary-on-dark transition-colors"
        >
          <ArrowLeft size={14} /> Back to Constituent Directory
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — 360 Profile Summary */}
        <CRMContactProfileCard contact={contact} openTaskCount={openTaskCount} />

        {/* Right Column — Tabbed Activities, Tasks, Email Sender, and Note Composer */}
        <div className="lg:col-span-2">
          <CRMContactWorkspace
            contact={contact}
            activities={activities}
            tasks={tasks}
            activityPage={activityPage}
            activityPageSize={activityPageSize}
            activityCount={activityCount}
            tasksTruncated={tasksTruncated}
            taskCount={taskCount}
            openTaskCount={openTaskCount}
          />
        </div>
      </div>
    </div>
  );
}
