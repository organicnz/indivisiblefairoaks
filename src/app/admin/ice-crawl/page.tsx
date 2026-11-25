import type { Metadata } from 'next';
import { AdminNotice } from '@/components/admin/AdminNotice';
import { AdminStatGrid } from '@/components/admin/AdminStatGrid';
import { IceCrawlDiscovery } from '@/components/admin/IceCrawlDiscovery';
import { IceCrawlManager } from '@/components/admin/IceCrawlManager';
import { IceCrawlPromotion } from '@/components/admin/IceCrawlPromotion';
import { IceCrawlHeader } from '@/components/admin/ice/IceCrawlHeader';
import { requireAdminPage } from '@/lib/admin-auth';
import {
  countCollapsedIceCrawlDiscoveries,
  countReviewableIceCrawlDiscoveries,
  getIceCrawlStore,
  type IceCrawlDiscoveryOrder,
  type IceCrawlStore,
  listIceCrawlDiscoveries,
  listIceCrawlSources,
  listTopConfidenceIceCrawlDiscoveries,
  listUnconfirmedDiscoveryReports,
} from '@/lib/ice-crawl-store';
import type {
  IceCrawlDiscovery as IceCrawlDiscoveryRow,
  IceCrawlSource,
} from '@/lib/ice-crawl-types';

export const instant = false;

const DISCOVERY_PAGE_SIZE = 30;

export const metadata: Metadata = {
  title: 'Web report crawler — Admin · Indivisible Fair Oaks',
  robots: { index: false, follow: false },
};

export default async function AdminIceCrawlPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { adminClient } = await requireAdminPage('/admin/ice-crawl');
  const params = await searchParams;
  const rawPage = typeof params.discoveryPage === 'string' ? params.discoveryPage : '';
  const page = Math.max(1, Number.parseInt(rawPage, 10) || 1);
  const sort: IceCrawlDiscoveryOrder =
    params.discoverySort === 'confidence' ? 'confidence' : 'oldest';
  const store = getIceCrawlStore();
  let sources: IceCrawlSource[] = [];
  let discoveries: IceCrawlDiscoveryRow[] = [];
  let topConfidence: IceCrawlDiscoveryRow[] = [];
  let discoveryTotal = 0;
  let collapsedDuplicates = 0;
  let unconfirmed: Awaited<ReturnType<typeof listUnconfirmedDiscoveryReports>> = [];
  let loadError = false;
  let discoveryLoadError = false;

  if (store) {
    const crawlerStore = adminClient as unknown as IceCrawlStore;
    try {
      sources = await listIceCrawlSources(crawlerStore);
    } catch {
      loadError = true;
    }
    try {
      const [rows, total] = await Promise.all([
        listIceCrawlDiscoveries(crawlerStore, 'pending', DISCOVERY_PAGE_SIZE, {
          offset: (page - 1) * DISCOVERY_PAGE_SIZE,
          order: sort,
        }),
        countReviewableIceCrawlDiscoveries(crawlerStore),
      ]);
      discoveries = rows;
      discoveryTotal = total;
    } catch {
      discoveryLoadError = true;
    }
    try {
      collapsedDuplicates = await countCollapsedIceCrawlDiscoveries(crawlerStore);
    } catch {
      collapsedDuplicates = 0;
    }
    try {
      topConfidence = await listTopConfidenceIceCrawlDiscoveries(crawlerStore, 5);
    } catch {
      topConfidence = [];
    }
    try {
      unconfirmed = await listUnconfirmedDiscoveryReports(crawlerStore, 10);
    } catch {
      unconfirmed = [];
    }
  } else {
    loadError = true;
    discoveryLoadError = true;
  }

  const enabled = sources.filter((source) => source.enabled).length;
  const totalPages = sources.reduce((sum, source) => sum + source.last_page_count, 0);
  const totalReports = sources.reduce((sum, source) => sum + source.last_report_count, 0);

  return (
    <div>
      <IceCrawlHeader />

      <AdminStatGrid
        stats={[
          {
            label: 'Approved sources',
            value: (
              <>
                {enabled}
                <span className="ml-1 font-mono text-sm text-muted-foreground">
                  / {sources.length}
                </span>
              </>
            ),
          },
          { label: 'Pages fetched last run', value: totalPages },
          { label: 'New source reports', value: totalReports },
        ]}
      />

      <AdminNotice>
        <strong className="text-foreground">Rights and completeness:</strong> only add a source when
        the chapter has the right to republish its text. The crawler follows public same-origin
        links up to the source page limit. If it hits the limit or a robots.txt block, the source is
        marked <strong className="text-foreground">partial</strong> with the unvisited count, rather
        than silently claiming a complete run. AI extraction only uses verbatim excerpts; the
        source-refinement endpoint removes navigation and page chrome without rewriting report
        wording, and deterministic extraction remains the fallback when AI is unavailable.
      </AdminNotice>

      <IceCrawlDiscovery
        discoveries={discoveries}
        topConfidence={topConfidence}
        total={discoveryTotal}
        collapsedDuplicates={collapsedDuplicates}
        page={page}
        pageSize={DISCOVERY_PAGE_SIZE}
        sort={sort}
        loadError={discoveryLoadError}
      />

      <IceCrawlPromotion reports={unconfirmed} />

      {loadError ? (
        <div role="alert" className="border border-accent/40 bg-accent/10 p-5 text-sm">
          The crawler tables could not be loaded. Check the database migration and try again.
        </div>
      ) : (
        <IceCrawlManager sources={sources} />
      )}
    </div>
  );
}
