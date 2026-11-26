import type { Metadata } from 'next';
import { AdminNotice } from '@/components/admin/AdminNotice';
import { AdminStatGrid } from '@/components/admin/AdminStatGrid';
import { IceCrawlDiscovery } from '@/components/admin/IceCrawlDiscovery';
import { IceCrawlManager } from '@/components/admin/IceCrawlManager';
import { IceCrawlPromotion } from '@/components/admin/IceCrawlPromotion';
import { IceCrawlHeader } from '@/components/admin/ice/IceCrawlHeader';
import { IceCrawlPublicationGate } from '@/components/admin/ice/IceCrawlPublicationGate';
import { requireAdminPage } from '@/lib/admin-auth';
import { env } from '@/lib/env';
import {
  countCollapsedIceCrawlDiscoveries,
  countReviewableIceCrawlDiscoveries,
  getIceCrawlStore,
  getPublishedSourceReports,
  getSourceReportPublicationSummary,
  type IceCrawlDiscoveryOrder,
  type IceCrawlStore,
  listIceCrawlDiscoveries,
  listIceCrawlSources,
  listRightsConfirmedDrafts,
  listTopConfidenceIceCrawlDiscoveries,
  listUnconfirmedDiscoveryReports,
} from '@/lib/ice-crawl-store';
import type {
  IceCrawlDiscovery as IceCrawlDiscoveryRow,
  IceCrawlSource,
} from '@/lib/ice-crawl-types';
import { parseIceDiscoveryAutoPublish } from '@/lib/ice-discovery-publication';

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
  let confirmedDrafts: Awaited<ReturnType<typeof listRightsConfirmedDrafts>> = [];
  let publicationSummary = {
    publicCount: 0,
    scheduledCount: 0,
    awaitingRightsCount: 0,
    rightsConfirmedDraftCount: 0,
  };
  let publicPreview: Awaited<ReturnType<typeof getPublishedSourceReports>> = [];
  const autoPublish = parseIceDiscoveryAutoPublish(env.ICE_DISCOVERY_AUTO_PUBLISH);
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
    try {
      const [summary, publicRows, drafts] = await Promise.all([
        getSourceReportPublicationSummary(crawlerStore),
        getPublishedSourceReports(crawlerStore, 5),
        listRightsConfirmedDrafts(crawlerStore, 10),
      ]);
      publicationSummary = summary;
      publicPreview = publicRows;
      confirmedDrafts = drafts;
    } catch {
      // The publication preview is an operational aid, not the discovery queue.
      // Leave it empty rather than hiding the rest of the page behind one read.
    }
  } else {
    loadError = true;
    discoveryLoadError = true;
  }

  const enabled = sources.filter((source) => source.enabled).length;
  const totalPages = sources.reduce((sum, source) => sum + source.last_page_count, 0);
  const totalReports = sources.reduce((sum, source) => sum + source.last_report_count, 0);
  const draftPreview = [
    ...unconfirmed.map((report) => ({
      id: report.id,
      title: report.title,
      source_name: report.source_name,
      rights_status: 'unconfirmed' as const,
      publication_status:
        report.publication_status === 'published' ? ('published' as const) : ('draft' as const),
      published_at: report.published_at,
    })),
    ...confirmedDrafts,
  ].slice(0, 5);

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

      <IceCrawlPublicationGate
        autoPublish={autoPublish}
        publicCount={publicationSummary.publicCount}
        scheduledCount={publicationSummary.scheduledCount}
        awaitingRightsCount={publicationSummary.awaitingRightsCount}
        rightsConfirmedDraftCount={publicationSummary.rightsConfirmedDraftCount}
        publicPreview={publicPreview}
        draftPreview={draftPreview}
      />

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

      <IceCrawlPromotion
        reports={unconfirmed}
        confirmedDrafts={confirmedDrafts}
        autoPublish={autoPublish}
      />

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
