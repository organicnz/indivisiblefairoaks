import { ArrowRight, FileText } from 'lucide-react';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';
import type { ContentRow } from './dashboard-types';

type RecentContentProps = {
  dataPoints: Record<string, string>;
  recentContent: ContentRow[];
};

export function RecentContent({ dataPoints, recentContent }: RecentContentProps) {
  return (
        <section className="bg-surface-card border border-border rounded-3xl p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-[11px] font-semibold tracking-[-0.01em] text-muted-foreground">
              <DataPoint as="span" name="admin.dashboard.recent_title" initialData={dataPoints}>
                Recently edited
              </DataPoint>
            </h2>
            <Link
              href="/admin/content"
              className="inline-flex items-center gap-1 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:text-primary dark:hover:text-primary-on-dark transition-colors"
            >
              <DataPoint as="span" name="admin.dashboard.view_all" initialData={dataPoints}>
                View all
              </DataPoint>{' '}
              <ArrowRight size={11} />
            </Link>
          </div>
          {recentContent.length === 0 ? (
            <p className="text-muted-foreground font-bold text-sm">
              <DataPoint as="span" name="admin.dashboard.no_content" initialData={dataPoints}>
                No pages or posts yet.
              </DataPoint>
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentContent.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/content/${c.id}`}
                    className="flex items-center gap-3 py-3 group"
                  >
                    <FileText
                      size={13}
                      className="text-muted-foreground shrink-0"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-foreground uppercase tracking-wider truncate group-hover:text-primary dark:group-hover:text-primary-on-dark transition-colors">
                        {c.title || c.slug}
                      </span>
                      <span className="block text-[10px] text-muted-foreground font-bold uppercase tracking-tight">
                        {c.type || 'page'} ·{' '}
                        {c.updated_at
                          ? new Date(c.updated_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'N/A'}
                      </span>
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 ${
                        c.status === 'publish'
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : 'bg-surface-muted text-muted-foreground'
                      }`}
                    >
                      {c.status === 'publish' ? 'Published' : 'Draft'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
  );
}
