import { CRMContactList } from '@/components/admin/crm/CRMContactList';
import { CRMHeader } from '@/components/admin/crm/CRMHeader';
import { CRMMetrics } from '@/components/admin/crm/CRMMetrics';
import {
  getCRMContacts,
  getCRMEdgeFunctionHealth,
  getCRMExistingTags,
  getCRMSegments,
  getCRMStats,
} from '@/lib/actions/crm';
import { requireAdminPage } from '@/lib/admin-auth';
import { parseConsentFilter } from '@/lib/crm-filters';
import { CRM_DIRECTORY_PAGE_SIZE } from '@/lib/crm-limits';
import { getDataPoints } from '@/lib/queries/civic';

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
  await requireAdminPage();
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

  const [stats, { contacts, totalCount }, segmentRead, tagScan, backendStatus, dataPoints] =
    await Promise.all([
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
      getDataPoints('admin'),
    ]);
  // The scan behind `existingTags` may have hit its ceiling. On *this* page that
  // matters more than on the composer: a tag in the filter bar is how an
  // organiser finds the constituents carrying it, so an absent one reads as "this
  // chapter has no such tag" — and the free-text search is the only remaining
  // route to those people.
  const tagsIncomplete = tagScan.truncated;

  return (
    <div className="space-y-8">
      <CRMHeader
        dataPoints={dataPoints}
        openTasks={stats.openTasks}
        backendStatus={backendStatus}
      />

      <CRMMetrics
        dataPoints={dataPoints}
        totalContacts={stats.totalContacts}
        activeVolunteers={stats.activeVolunteers}
        localDistrict={stats.localDistrict}
        totalDonors={stats.totalDonors}
        totalDonationsCents={stats.totalDonationsCents}
      />

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
