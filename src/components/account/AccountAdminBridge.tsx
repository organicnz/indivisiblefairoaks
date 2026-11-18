import { ArrowRight, Shield, Users } from 'lucide-react';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';

type AccountAdminBridgeProps = {
  dataPoints: Record<string, string>;
};

export function AccountAdminBridge({ dataPoints }: AccountAdminBridgeProps) {
  return (
          <div className="civic-panel mb-10 flex flex-col items-start justify-between gap-6 p-6 animate-in fade-in md:flex-row md:items-center">
            <div className="flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-sm border border-primary/20 bg-primary/10 text-primary-ink dark:border-primary/30 dark:bg-primary/20 dark:text-primary-on-dark">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary-ink dark:text-primary-on-dark-muted">
                    <DataPoint name="account.admin_bridge.badge" initialData={dataPoints}>
                      Chapter Leadership
                    </DataPoint>
                  </span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                </div>
                <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
                  <DataPoint name="account.admin_bridge.title" initialData={dataPoints}>
                    Admin control & civic CRM
                  </DataPoint>
                </h2>
                <p className="text-xs text-muted-foreground dark:text-ink-muted-on-dark font-medium">
                  <DataPoint name="account.admin_bridge.desc" initialData={dataPoints}>
                    Manage chapter constituents, target volunteer rings, and dispatch Resend
                    broadcasts.
                  </DataPoint>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <Link
                href="/admin/crm"
                className="inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary-dark dark:bg-primary-bright dark:hover:bg-primary-light"
              >
                <Users className="w-4 h-4" />
                <span>
                  <DataPoint name="account.admin_bridge.crm_btn" initialData={dataPoints}>
                    Open CRM
                  </DataPoint>
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 rounded-sm border border-border bg-surface-muted px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-surface-muted/80 dark:border-white/10 dark:bg-white/10 dark:text-ink-on-dark dark:hover:bg-white/15 dark:hover:text-white"
              >
                <span>
                  <DataPoint name="account.admin_bridge.control_btn" initialData={dataPoints}>
                    Control Center
                  </DataPoint>
                </span>
              </Link>
            </div>
          </div>
  );
}
