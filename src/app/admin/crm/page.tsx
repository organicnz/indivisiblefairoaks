import {
  CalendarCheck,
  DollarSign,
  HeartHandshake,
  MapPin,
  Megaphone,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { CRMContactList } from '@/components/admin/crm/CRMContactList';
import {
  getCRMContacts,
  getCRMEdgeFunctionHealth,
  getCRMExistingTags,
  getCRMSegments,
  getCRMStats,
} from '@/lib/actions/crm';
import { requireAdmin } from '@/lib/admin-auth';
import { parseConsentFilter } from '@/lib/crm-filters';
import { CRM_DIRECTORY_PAGE_SIZE } from '@/lib/crm-limits';

// Deliberate Cache Components opt-out (Block): admin surface behind requireAdmin() session gate.
export const instant = false;

export async function generateMetadata() {
  return {
    title: 'Civic CRM — Admin · Indivisible Fair Oaks',
    description:
      'Manage community activists, grassroots donors, resistance choir members, and local supporters.',
    robots: { index: false, follow: false },
  };
}

export default async function AdminCRMPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    district?: string;
    tag?: string;
    consent?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const currentQuery = (params.q || '').trim();
  const currentStatus = params.status || 'all';
  const currentDistrict = params.district || 'all';
  const currentTag = params.tag || 'all';
  // `parseConsentFilter`, not an inline ternary: the parser has to accept every
  // value `filterParams` emits, and that set grew a third state. An inline
  // parser quietly discarded the newest one and showed the whole directory.
  const currentConsent = parseConsentFilter(params.consent);
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const pageSize = CRM_DIRECTORY_PAGE_SIZE;

  const [stats, { contacts, totalCount }, segmentRead, tagScan, backendStatus] = await Promise.all([
    getCRMStats(),
    getCRMContacts({
      query: currentQuery,
      status: currentStatus,
      district: currentDistrict,
      tag: currentTag,
      consent: currentConsent === 'all' ? undefined : currentConsent,
      page,
      pageSize,
    }),
    getCRMSegments(),
    getCRMExistingTags(),
    getCRMEdgeFunctionHealth(),
  ]);
  // The scan behind `existingTags` may have hit its ceiling. On *this* page that
  // matters more than on the composer: a tag in the filter bar is how an
  // organiser finds the constituents carrying it, so an absent one reads as "this
  // chapter has no such tag" — and the free-text search is the only remaining
  // route to those people.
  const tagsIncomplete = tagScan.truncated;

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-xs">
              <UsersRound size={20} />
            </div>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
              Admin Panel · Grassroots CRM
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground uppercase">
            Constituent Directory
          </h1>
          <div className="h-1.5 w-24 bg-primary mt-3" />
          <p className="mt-3 text-xs font-bold text-muted-foreground max-w-2xl">
            Track activists, resist choir singers, grassroots donors, and local supporters across
            CA-06 and CA-03 with direct Resend outreach and campaign blasts.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Postgres DB: Live
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
              Supabase S3 Media: {backendStatus.storage ? 'Connected' : 'Degraded'}
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
              Edge Sender: {backendStatus.edgeFunction ? 'Ready' : 'Direct Fallback'}
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
            Follow-ups{stats.openTasks > 0 ? ` (${stats.openTasks})` : ''}
          </Link>
          <Link
            href="/admin/crm/broadcasts"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-black uppercase tracking-wider rounded-xl transition-colors shadow-xs"
          >
            <Megaphone size={14} className="text-primary-light" />
            Email Broadcasts
          </Link>
        </div>
      </div>

      {/* KPI / Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Constituents */}
        <div className="bg-surface-card p-5 rounded-2xl border border-border shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <UsersRound size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Total Constituents
            </p>
            <p className="text-2xl font-black text-foreground mt-0.5">{stats.totalContacts}</p>
          </div>
        </div>

        {/* Active Volunteers */}
        <div className="bg-surface-card p-5 rounded-2xl border border-border shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <HeartHandshake size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Volunteers & Organizers
            </p>
            <p className="text-2xl font-black text-foreground mt-0.5">{stats.activeVolunteers}</p>
          </div>
        </div>

        {/* Local District */}
        <div className="bg-surface-card p-5 rounded-2xl border border-border shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <MapPin size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              CA-06 / CA-03 Grassroots
            </p>
            <p className="text-2xl font-black text-foreground mt-0.5">{stats.localDistrict}</p>
          </div>
        </div>

        {/* Grassroots Donors */}
        <div className="bg-surface-card p-5 rounded-2xl border border-border shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <DollarSign size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Grassroots Donors
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <p className="text-2xl font-black text-foreground">{stats.totalDonors}</p>
              <span className="text-xs font-bold text-amber-700">
                $
                {(stats.totalDonationsCents / 100).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Directory & Filter Table */}
      <CRMContactList
        initialContacts={contacts}
        totalCount={totalCount}
        currentQuery={currentQuery}
        currentStatus={currentStatus}
        currentDistrict={currentDistrict}
        currentTag={currentTag}
        currentConsent={currentConsent}
        currentPage={page}
        pageSize={pageSize}
        existingTags={tagScan.tags}
        segments={segmentRead.segments}
        segmentsTruncated={segmentRead.truncated}
        tagsMayBeIncomplete={tagsIncomplete}
      />
    </div>
  );
}
