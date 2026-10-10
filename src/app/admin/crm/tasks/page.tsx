import { CalendarCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { CRMTasksClient } from '@/components/admin/crm/CRMTasksClient';
import { getCRMTasks, type TaskScope } from '@/lib/actions/crm';
import { requireAdmin } from '@/lib/admin-auth';

// Deliberate Cache Components opt-out (Block): admin surface behind requireAdmin() session gate.
export const instant = false;

const VALID_SCOPES: TaskScope[] = ['open', 'overdue', 'upcoming', 'done', 'all'];

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Follow-ups — Civic CRM · Indivisible Fair Oaks',
    description: 'Open and overdue constituent follow-up tasks for chapter organizers.',
    robots: { index: false, follow: false },
  };
}

export default async function AdminCRMTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; page?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const scope: TaskScope = VALID_SCOPES.includes(params.scope as TaskScope)
    ? (params.scope as TaskScope)
    : 'open';
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const pageSize = 100;

  const { tasks, totalCount } = await getCRMTasks({ scope, page, pageSize });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-xs">
              <CalendarCheck size={20} />
            </div>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
              Admin Panel · Grassroots CRM
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground uppercase">
            Follow-ups
          </h1>
          <div className="h-1.5 w-24 bg-primary mt-3" />
          <p className="mt-3 text-xs font-bold text-muted-foreground max-w-2xl">
            Due-dated organizer tasks linked to constituents — calls, rides, event reminders, and
            promise tracking.
          </p>
        </div>
        <div className="text-xs font-bold text-muted-foreground self-start md:self-auto bg-surface-muted border border-border rounded-xl px-4 py-2.5">
          <span className="text-foreground font-black text-lg align-middle">{totalCount}</span>{' '}
          {scope === 'all' ? 'total' : scope} follow-up{totalCount === 1 ? '' : 's'}
        </div>
      </div>

      <CRMTasksClient
        tasks={tasks}
        scope={scope}
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
      />
    </div>
  );
}
