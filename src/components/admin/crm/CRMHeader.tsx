import { CalendarCheck, Megaphone, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';

type CRMHeaderProps = {
  dataPoints: Record<string, string>;
  openTasks: number;
  backendStatus: {
    storage: boolean;
    edgeFunction: boolean;
  };
};

export function CRMHeader({ dataPoints, openTasks, backendStatus }: CRMHeaderProps) {
  return (
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-xs">
              <UsersRound size={20} />
            </div>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
              <DataPoint as="span" name="admin.crm.eyebrow" initialData={dataPoints}>
                Admin Panel · Grassroots CRM
              </DataPoint>
            </span>
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
            <DataPoint as="span" name="admin.crm.title" initialData={dataPoints}>
              Constituent directory
            </DataPoint>
          </h1>
          <div className="h-1.5 w-24 bg-primary mt-3" />
          <p className="mt-3 text-xs font-bold text-muted-foreground max-w-2xl">
            <DataPoint as="span" name="admin.crm.subtitle" initialData={dataPoints}>
              Track activists, resist choir singers, grassroots donors, and local supporters across
              CA-06 and CA-03 with direct Resend outreach and campaign blasts.
            </DataPoint>
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <DataPoint as="span" name="admin.crm.db_label" initialData={dataPoints}>
                Postgres DB
              </DataPoint>
              : Live
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                backendStatus.storage
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${backendStatus.storage ? 'bg-emerald-500' : 'bg-amber-500'}`}
              />
              <DataPoint as="span" name="admin.crm.storage_label" initialData={dataPoints}>
                Supabase S3 Media
              </DataPoint>
              : {backendStatus.storage ? 'Connected' : 'Degraded'}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                backendStatus.edgeFunction
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${backendStatus.edgeFunction ? 'bg-emerald-500' : 'bg-blue-500'}`}
              />
              <DataPoint as="span" name="admin.crm.sender_label" initialData={dataPoints}>
                Edge Sender
              </DataPoint>
              : {backendStatus.edgeFunction ? 'Ready' : 'Direct Fallback'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          <Link
            href="/admin/crm/tasks"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface-card text-foreground hover:bg-surface-muted border border-border text-xs font-black uppercase tracking-wider rounded-xl transition-colors shadow-xs"
          >
            <CalendarCheck size={14} className="text-amber-600" />
            <DataPoint as="span" name="admin.crm.followups_label" initialData={dataPoints}>
              Follow-ups
            </DataPoint>
            {openTasks > 0 ? ` (${openTasks})` : ''}
          </Link>
          <Link
            href="/admin/crm/broadcasts"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white hover:bg-primary-light text-xs font-black uppercase tracking-wider rounded-xl transition-colors shadow-xs"
          >
            <Megaphone size={14} className="text-primary-light" />
            <DataPoint as="span" name="admin.crm.btn_compose" initialData={dataPoints}>
              Email Broadcasts
            </DataPoint>
          </Link>
        </div>
      </div>
  );
}
