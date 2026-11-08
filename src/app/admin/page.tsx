import {
  ArrowRight,
  Calendar,
  FilePlus2,
  FileText,
  Link2,
  Newspaper,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';
import { requireAdminPage } from '@/lib/admin-auth';
import { getDataPoints } from '@/lib/queries/civic';

// Deliberate Cache Components opt-out (Block): admin dashboard with live counts behind requireAdmin().
export const instant = false;

export const metadata = {
  title: 'Dashboard — Admin · Indivisible Fair Oaks',
  robots: { index: false, follow: false },
};

type EventRow = {
  slug: string;
  title: string;
  date_label: string;
  time_label: string;
  location_name: string;
  starts_at: string | null;
};

type ContentRow = {
  id: number;
  title: string;
  slug: string;
  status: string | null;
  type: string | null;
  updated_at: string | null;
};

export default async function AdminDashboardPage() {
  const { adminClient } = await requireAdminPage();

  const [
    { count: eventCount },
    { data: content },
    { count: memberCount },
    { data: upcomingEvents },
    dataPoints,
  ] = await Promise.all([
    adminClient.from('events').select('slug', { count: 'exact', head: true }),
    adminClient
      .from('content')
      .select('id, title, slug, status, type, updated_at')
      .order('updated_at', { ascending: false })
      .limit(500),
    adminClient.from('profiles').select('id', { count: 'exact', head: true }),
    adminClient
      .from('events')
      .select('slug, title, date_label, time_label, location_name, starts_at')
      .order('starts_at', { ascending: true })
      .limit(5),
    getDataPoints('admin'),
  ]);

  const eventRows = (upcomingEvents || []) as EventRow[];
  const contentRows = (content || []) as ContentRow[];
  const recentContent = contentRows.slice(0, 5);
  const published = contentRows.filter((c) => c.status === 'publish').length;
  const drafts = contentRows.length - published;

  return (
    <div>
      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-primary dark:bg-primary-bright rounded-full flex items-center justify-center">
            <TrendingUp size={14} className="text-white" />
          </div>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
            <DataPoint as="span" name="admin.panel.eyebrow" initialData={dataPoints}>
              Admin Panel
            </DataPoint>
          </span>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-foreground uppercase">
          <DataPoint as="span" name="admin.dashboard.title" initialData={dataPoints}>
            Dashboard
          </DataPoint>
        </h1>
        <div className="h-1.5 w-24 bg-primary dark:bg-primary-bright mt-3" />
      </div>

      {/* Quick Publishing & Civic Management Bar */}
      <div className="bg-surface-card border border-border rounded-3xl p-6 shadow-xs mb-8">
        <div className="mb-4">
          <h2 className="text-sm font-black text-foreground uppercase tracking-wider">
            Civic Publishing &amp; Content
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Publish new dispatches, update chapter events, issue bulletins, and maintain coalition
            links.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Link
            href="/admin/content/new?type=post"
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-primary dark:bg-primary-bright text-white hover:bg-primary-dark dark:hover:bg-primary-light transition-[background-color,border-color,transform] duration-150 text-center shadow-xs font-bold text-xs uppercase tracking-wider group focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <FilePlus2 size={20} className="group-hover:scale-110 transition-transform" />
            <span>New Post</span>
          </Link>
          <Link
            href="/admin/events"
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-surface-muted border border-border text-foreground hover:border-primary/40 hover:bg-primary/5 transition-[background-color,border-color,transform] duration-150 text-center font-bold text-xs uppercase tracking-wider group focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <Calendar
              size={20}
              className="text-primary-ink dark:text-primary-on-dark group-hover:scale-110 transition-transform"
            />
            <span>Events &amp; Rallies</span>
          </Link>
          <Link
            href="/admin/news"
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-surface-muted border border-border text-foreground hover:border-primary/40 hover:bg-primary/5 transition-[background-color,border-color,transform] duration-150 text-center font-bold text-xs uppercase tracking-wider group focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <Newspaper
              size={20}
              className="text-accent-gold group-hover:scale-110 transition-transform"
            />
            <span>News &amp; Bulletins</span>
          </Link>
          <Link
            href="/admin/links"
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-surface-muted border border-border text-foreground hover:border-primary/40 hover:bg-primary/5 transition-[background-color,border-color,transform] duration-150 text-center font-bold text-xs uppercase tracking-wider group focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <Link2
              size={20}
              className="text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform"
            />
            <span>Action Links</span>
          </Link>
          <Link
            href="/admin/content"
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-surface-muted border border-border text-foreground hover:border-primary/40 hover:bg-primary/5 transition-[background-color,border-color,transform] duration-150 text-center font-bold text-xs uppercase tracking-wider group focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <FileText
              size={20}
              className="text-muted-foreground group-hover:scale-110 transition-transform"
            />
            <span>All Pages &amp; Posts</span>
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            dpKey: 'admin.kpi.published',
            label: 'Published',
            value: published,
            icon: FileText,
          },
          {
            dpKey: 'admin.kpi.drafts',
            label: 'Drafts',
            value: drafts,
            icon: FilePlus2,
          },
          {
            dpKey: 'admin.kpi.events',
            label: 'Civic events',
            value: eventCount ?? 0,
            icon: Calendar,
          },
          {
            dpKey: 'admin.kpi.members',
            label: 'Community members',
            value: memberCount ?? 0,
            icon: Users,
          },
        ].map(({ dpKey, label, value, icon: Icon }) => (
          <div
            key={label}
            className="bg-secondary rounded-3xl p-6 border border-white/10 shadow-xs"
          >
            <Icon size={16} className="text-primary-on-dark mb-3" />
            <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-1">
              <DataPoint as="span" name={dpKey} initialData={dataPoints}>
                {label}
              </DataPoint>
            </p>
            <p className="text-2xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent content */}
        <section className="bg-surface-card border border-border rounded-3xl p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.25em]">
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

        {/* Upcoming events / actions */}
        <section className="bg-surface-card border border-border rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.25em]">
              <DataPoint as="span" name="admin.dashboard.events_title" initialData={dataPoints}>
                Upcoming Actions
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
      </div>
    </div>
  );
}
