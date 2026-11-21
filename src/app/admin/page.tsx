import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminAuditOutboxAlert } from '@/components/admin/audit/AdminAuditOutboxAlert';
import { DashboardHeader } from '@/components/admin/dashboard/DashboardHeader';
import type { ContentRow, EventRow } from '@/components/admin/dashboard/dashboard-types';
import { KpiCards } from '@/components/admin/dashboard/KpiCards';
import { QuickActions } from '@/components/admin/dashboard/QuickActions';
import { RecentContent } from '@/components/admin/dashboard/RecentContent';
import { UpcomingActions } from '@/components/admin/dashboard/UpcomingActions';
import { getAdminAuditOutboxHealth } from '@/lib/admin-audit-outbox';
import { requireAdminPage } from '@/lib/admin-auth';
import { getDataPoints } from '@/lib/queries/civic';

// Deliberate Cache Components opt-out (Block): admin dashboard with live counts behind requireAdmin().
export const instant = false;

export const metadata = {
  // `/admin` shares its segment with the admin layout, so the layout's title
  // template does not apply here. Stay bare and let the root template append
  // the site name once.
  title: 'Dashboard · Admin',
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const { adminClient } = await requireAdminPage();
  // The generated database types predate `is_hidden`, so this query needs the
  // same untyped client the public query uses. The end instant is the cutoff,
  // so an event that started this morning but runs all afternoon is still
  // current. Unlike the public calendar, recurring rows get no blanket
  // exemption here: a dated recurring row whose last stored occurrence has
  // ended is stale on the admin dashboard. Undated rows are retained because
  // they cannot be proven past.
  const eventsClient = adminClient as unknown as SupabaseClient;
  const now = new Date().toISOString();

  const [
    { count: eventCount },
    { count: contentCount },
    { count: publishedCount },
    { data: content },
    { count: memberCount },
    { data: upcomingEvents },
    dataPoints,
    outboxHealthResult,
  ] = await Promise.all([
    adminClient.from('events').select('slug', { count: 'exact', head: true }),
    adminClient.from('content').select('id', { count: 'exact', head: true }),
    adminClient
      .from('content')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'publish'),
    adminClient
      .from('content')
      .select('id, title, slug, status, type, updated_at')
      .order('updated_at', { ascending: false })
      .limit(5),
    adminClient.from('profiles').select('id', { count: 'exact', head: true }),
    eventsClient
      .from('events')
      .select('slug, title, date_label, time_label, location_name, starts_at, ends_at')
      .eq('is_hidden', false)
      .or(
        [
          `ends_at.gte.${now}`,
          `and(ends_at.is.null,starts_at.gte.${now})`,
          'and(ends_at.is.null,starts_at.is.null)',
        ].join(',')
      )
      .order('starts_at', { ascending: true, nullsFirst: false })
      .limit(5),
    getDataPoints('admin'),
    getAdminAuditOutboxHealth(adminClient)
      .then((health) => ({ health, error: false }))
      .catch(() => ({ health: null, error: true })),
  ]);

  const eventRows = (upcomingEvents || []) as EventRow[];
  const recentContent = (content || []) as ContentRow[];
  // Exact counts, not a count of the most recent 500 rows. The cards read
  // "Published" and "Drafts", so a chapter past 500 pages silently saw the
  // totals of a different, truncated set. `max` only guards against the two
  // count queries observing different snapshots while a page is being written.
  const published = publishedCount ?? 0;
  const drafts = Math.max((contentCount ?? 0) - published, 0);

  return (
    <div>
      <DashboardHeader dataPoints={dataPoints} />
      <AdminAuditOutboxAlert health={outboxHealthResult.health} error={outboxHealthResult.error} />
      <QuickActions />
      <KpiCards
        dataPoints={dataPoints}
        published={published}
        drafts={drafts}
        eventCount={eventCount ?? 0}
        memberCount={memberCount ?? 0}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RecentContent dataPoints={dataPoints} recentContent={recentContent} />
        <UpcomingActions dataPoints={dataPoints} eventRows={eventRows} />
      </div>
    </div>
  );
}
