import { CRMBroadcastComposer } from '@/components/admin/crm/CRMBroadcastComposer';
import {
  getCRMBroadcastDrafts,
  getCRMBroadcastHistoryPage,
  getCRMExistingTags,
  getCRMSegments,
} from '@/lib/actions/crm';
import { requireAdmin } from '@/lib/admin-auth';

// Deliberate Cache Components opt-out (Block): admin surface behind requireAdmin() session gate.
export const instant = false;

export async function generateMetadata() {
  return {
    title: 'Campaign Broadcasts — Civic CRM · Indivisible Fair Oaks',
    description:
      'Compose and dispatch segmented email blasts to activists and supporters via Resend.',
    robots: { index: false, follow: false },
  };
}

export default async function AdminCRMBroadcastsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  /*
   * The history read is paged, and the page is what decides which page.
   *
   * `getCRMBroadcastHistoryPage` existed and nothing called it: the composer was
   * handed `getCRMBroadcasts()`, which is `.limit(25)` with no offset and no
   * count. A chapter past twenty-five campaigns could see its first twenty-five
   * and nothing else, with no indication the list ended — and because the heading
   * rendered `initialBroadcasts.length` it read "(25)", which looks like a
   * complete history rather than a truncated one.
   *
   * Clamped here as well as in the action, because `page` is a URL param: this is
   * the boundary that decides what the composer is allowed to believe.
   */
  const parsed = Number.parseInt(params.page || '1', 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

  const [history, drafts, segmentRead, tagScan] = await Promise.all([
    getCRMBroadcastHistoryPage({ page }),
    getCRMBroadcastDrafts(),
    getCRMSegments(),
    getCRMExistingTags(),
  ]);

  return (
    <CRMBroadcastComposer
      initialBroadcasts={history.broadcasts}
      totalBroadcastCount={history.totalCount}
      historyPage={history.page}
      initialDrafts={drafts}
      segments={segmentRead.segments}
      segmentsTruncated={segmentRead.truncated}
      existingTags={tagScan.tags}
      // Passed down rather than logged or swallowed. A tag held only by unscanned
      // rows gets no chip, so the chapter cannot target those constituents and the
      // composer would read as though nobody carries that tag.
      tagsMayBeIncomplete={tagScan.truncated}
    />
  );
}
