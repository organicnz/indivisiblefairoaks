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
import { getCRMContacts, getCRMExistingTags, getCRMSegments, getCRMStats } from '@/lib/actions/crm';
import { requireAdmin } from '@/lib/admin-auth';

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
  const currentConsent: 'all' | 'opted_out' | 'opted_in' =
    params.consent === 'opted_out'
      ? 'opted_out'
      : params.consent === 'opted_in'
        ? 'opted_in'
        : 'all';
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const pageSize = 50;

  const [stats, { contacts, totalCount }, segments, existingTags] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-xs">
              <UsersRound size={20} />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
              Admin Panel · Grassroots CRM
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-secondary uppercase">
            Constituent Directory
          </h1>
          <div className="h-1.5 w-24 bg-primary mt-3" />
          <p className="mt-3 text-xs font-bold text-slate-500 max-w-2xl">
            Track activists, resist choir singers, grassroots donors, and local supporters across
            CA-06 and CA-03 with direct Resend outreach and campaign blasts.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          <Link
            href="/admin/crm/tasks"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-secondary hover:bg-slate-50 border border-slate-200 text-xs font-black uppercase tracking-wider rounded-xl transition-colors shadow-xs"
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
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <UsersRound size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Total Constituents
            </p>
            <p className="text-2xl font-black text-secondary mt-0.5">{stats.totalContacts}</p>
          </div>
        </div>

        {/* Active Volunteers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <HeartHandshake size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Volunteers & Organizers
            </p>
            <p className="text-2xl font-black text-secondary mt-0.5">{stats.activeVolunteers}</p>
          </div>
        </div>

        {/* Local District */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <MapPin size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              CA-06 / CA-03 Grassroots
            </p>
            <p className="text-2xl font-black text-secondary mt-0.5">{stats.localDistrict}</p>
          </div>
        </div>

        {/* Grassroots Donors */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <DollarSign size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Grassroots Donors
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <p className="text-2xl font-black text-secondary">{stats.totalDonors}</p>
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
        existingTags={existingTags}
        segments={segments}
      />
    </div>
  );
}
