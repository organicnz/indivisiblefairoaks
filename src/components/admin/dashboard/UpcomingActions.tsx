import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';
import type { EventRow } from './dashboard-types';

type UpcomingActionsProps = {
  dataPoints: Record<string, string>;
  eventRows: EventRow[];
};

export function UpcomingActions({ dataPoints, eventRows }: UpcomingActionsProps) {
  return (
        <section className="bg-surface-card border border-border rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-[11px] font-semibold tracking-[-0.01em] text-muted-foreground">
              <DataPoint as="span" name="admin.dashboard.events_title" initialData={dataPoints}>
                Upcoming actions
              </DataPoint>
            </h2>
            <Link
              href="/admin/events"
              className="inline-flex items-center gap-1 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:text-primary dark:hover:text-primary-on-dark transition-colors"
            >
              <DataPoint as="span" name="admin.dashboard.view_events" initialData={dataPoints}>
                All events
              </DataPoint>{' '}
              <ArrowRight size={11} />
            </Link>
          </div>
          {eventRows.length === 0 ? (
            <p className="text-muted-foreground font-bold text-sm">
              <DataPoint as="span" name="admin.dashboard.no_events" initialData={dataPoints}>
                No upcoming events scheduled.
              </DataPoint>
            </p>
          ) : (
            <ul className="space-y-3">
              {eventRows.map((evt) => (
                <li
                  key={evt.slug}
                  className="flex flex-col gap-1 bg-surface-muted rounded-2xl p-3 border border-border"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-foreground uppercase tracking-wide truncate">
                      {evt.title}
                    </p>
                    <span className="text-[10px] font-mono font-bold text-primary dark:text-primary-on-dark shrink-0">
                      {evt.date_label}
                    </span>
                  </div>
                  {evt.location_name && (
                    <p className="text-[11px] text-muted-foreground font-medium truncate">
                      {evt.location_name}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/events"
            className="inline-flex items-center gap-1 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:text-primary dark:hover:text-primary-on-dark transition-colors mt-4"
          >
            <DataPoint as="span" name="admin.dashboard.manage_events" initialData={dataPoints}>
              Manage events &amp; mobilizations
            </DataPoint>{' '}
            <ArrowRight size={11} />
          </Link>
        </section>
  );
}
