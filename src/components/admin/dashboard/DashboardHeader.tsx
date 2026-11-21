import { Activity, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';

export function DashboardHeader({ dataPoints }: { dataPoints: Record<string, string> }) {
  return (
    <div className="flex flex-col mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary dark:bg-primary-bright rounded-full flex items-center justify-center">
            <TrendingUp size={14} className="text-white" />
          </div>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
            <DataPoint as="span" name="admin.panel.eyebrow" initialData={dataPoints}>
              Admin Panel
            </DataPoint>
          </span>
        </div>
        <Link
          href="/admin/audit/outbox"
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface-card px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Activity size={13} aria-hidden="true" />
          Audit outbox health
        </Link>
      </div>
      <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] text-foreground">
        <DataPoint as="span" name="admin.dashboard.title" initialData={dataPoints}>
          Dashboard
        </DataPoint>
      </h1>
      <div className="h-1.5 w-24 bg-primary dark:bg-primary-bright mt-3" />
    </div>
  );
}
