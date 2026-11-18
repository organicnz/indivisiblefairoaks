import { Globe2, ScanSearch } from 'lucide-react';
import type { Metadata } from 'next';
import { IceCrawlDiscovery } from '@/components/admin/IceCrawlDiscovery';
import { IceCrawlManager } from '@/components/admin/IceCrawlManager';
import { requireAdminPage } from '@/lib/admin-auth';
import {
  getIceCrawlStore,
  listIceCrawlDiscoveries,
  listIceCrawlSources,
  type IceCrawlStore,
} from '@/lib/ice-crawl-store';
import type { IceCrawlDiscovery as IceCrawlDiscoveryRow, IceCrawlSource } from '@/lib/ice-crawl-types';

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
  } else {
    loadError = true;
    discoveryLoadError = true;
  }

  const enabled = sources.filter((source) => source.enabled).length;
  const totalPages = sources.reduce((sum, source) => sum + source.last_page_count, 0);
  const totalReports = sources.reduce((sum, source) => sum + source.last_report_count, 0);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-white dark:bg-primary-bright">
              <ScanSearch size={14} aria-hidden="true" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
              Source-attributed collection
            </span>
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] text-foreground">
            Web report crawler
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Add public sources the chapter is allowed to republish. Every fetched page and every
            discovered report keeps its exact source URL and retrieval time. The public page
            republishes the readable source text with attribution; raw HTML and crawl errors stay
            admin-only.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 self-start border border-border bg-surface-card px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground sm:self-auto">
          <Globe2 className="size-3.5" aria-hidden="true" />
          robots.txt respected
        </div>
      </div>

      <div className="mb-5 grid gap-px border border-border bg-border sm:grid-cols-3">
        <div className="bg-surface-card p-4">
          <p className="font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Approved sources
          </p>
          <p className="mt-1 font-display text-3xl font-semibold tracking-[-0.03em]">
            {enabled}
            <span className="ml-1 font-mono text-sm text-muted-foreground">/ {sources.length}</span>
          </p>
        </div>
        <div className="bg-surface-card p-4">
          <p className="font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Pages fetched last run
          </p>
          <p className="mt-1 font-display text-3xl font-semibold tracking-[-0.03em]">{totalPages}</p>
        </div>
        <div className="bg-surface-card p-4">
          <p className="font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            New source reports
          </p>
          <p className="mt-1 font-display text-3xl font-semibold tracking-[-0.03em]">
            {totalReports}
          </p>
        </div>
      </div>

      <div className="mb-5 border border-accent/35 bg-accent/5 p-4 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Rights and completeness:</strong> only add a source when
        the chapter has the right to republish its text. The crawler follows public same-origin links
        up to the source page limit. If it hits the limit or a robots.txt block, the source is marked{' '}
        <strong className="text-foreground">partial</strong> with the unvisited count, rather than
        silently claiming a complete run. AI extraction only uses verbatim excerpts and falls back to
        deterministic extraction when Z.AI is not configured or cannot produce a grounded result.
      </div>

      <IceCrawlDiscovery discoveries={discoveries} loadError={discoveryLoadError} />

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
