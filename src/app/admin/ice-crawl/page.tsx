import type { Metadata } from 'next';
import { AdminNotice } from '@/components/admin/AdminNotice';
import { AdminStatGrid } from '@/components/admin/AdminStatGrid';
import { IceCrawlDiscovery } from '@/components/admin/IceCrawlDiscovery';
import { IceCrawlManager } from '@/components/admin/IceCrawlManager';
import { IceCrawlPromotion } from '@/components/admin/IceCrawlPromotion';
import { IceCrawlHeader } from '@/components/admin/ice/IceCrawlHeader';
import { requireAdminPage } from '@/lib/admin-auth';
import {
  getIceCrawlStore,
  type IceCrawlStore,
  listIceCrawlDiscoveries,
  listIceCrawlSources,
  listUnconfirmedDiscoveryReports,
} from '@/lib/ice-crawl-store';
import type {
  IceCrawlDiscovery as IceCrawlDiscoveryRow,
  IceCrawlSource,
} from '@/lib/ice-crawl-types';

export const instant = false;

export const metadata: Metadata = {
  title: 'Web report crawler — Admin · Indivisible Fair Oaks',
  robots: { index: false, follow: false },
};

export default async function AdminIceCrawlPage() {
  const { adminClient } = await requireAdminPage('/admin/ice-crawl');
  const store = getIceCrawlStore();
  let sources: IceCrawlSource[] = [];
  let discoveries: IceCrawlDiscoveryRow[] = [];
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
      discoveries = await listIceCrawlDiscoveries(crawlerStore, 'pending', 30);
    } catch {
      discoveryLoadError = true;
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

      <IceCrawlDiscovery discoveries={discoveries} loadError={discoveryLoadError} />

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
