import type { Metadata } from 'next';
import { ArchiveArticle } from '@/components/archive/ArchiveArticle';
import { ArchiveEmptyState } from '@/components/archive/ArchiveEmptyState';
import { ArchiveFooter } from '@/components/archive/ArchiveFooter';
import { ArchiveMasthead } from '@/components/archive/ArchiveMasthead';
import { ArchiveNav } from '@/components/archive/ArchiveNav';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { VoterGuidesSection } from '@/components/voter-info/VoterGuidesSection';
import { isMovedVoterGuide2026 } from '@/components/voter-info/voter-guides-2026';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints } from '@/lib/queries/civic';
import {
  getLegacyArchive,
  type LegacyArchive,
  legacyDocumentForDriveId,
  legacyDocumentUrl,
} from '@/lib/queries/legacy';

export const metadata: Metadata = pageMetadata({
  title: 'Chapter Archive',
  description:
    'Preserved public material from the chapter’s legacy Google Sites: voter guides, newsletters, event flyers, choir films, and historical organizing links.',
  path: '/archive',
});

export default async function ArchivePage() {
  // The 2026 voter guides are coded content, not legacy-capture content, so they
  // must not depend on the archive tables. `getLegacyArchive` already returns
  // empties when a query fails, but a rejection can still escape the cache
  // boundary — and one failed legacy read must not turn the route into a 500
  // that hides the material that was moved here.
  const emptyArchive: LegacyArchive = { pages: [], assets: [], links: [], documents: [] };
  const [legacy, dataPoints] = await Promise.all([
    getLegacyArchive().catch((error: unknown) => {
      console.error('[archive] legacy archive read failed; rendering coded content only:', error);
      return emptyArchive;
    }),
    getDataPoints('voter'),
  ]);
  const { pages, assets, links, documents } = legacy;

  const legacyHref = (driveId: string, fallback: string) => {
    const document = legacyDocumentForDriveId(documents, driveId);
    return document ? (legacyDocumentUrl(document) ?? fallback) : fallback;
  };
  const assetsByPage = new Map<string, typeof assets>();
  for (const asset of assets) {
    const list = assetsByPage.get(asset.source_page_path) ?? [];
    list.push(asset);
    assetsByPage.set(asset.source_page_path, list);
  }
  const linksByPage = new Map<string, typeof links>();
  for (const link of links) {
    const list = linksByPage.get(link.page_id) ?? [];
    list.push(link);
    linksByPage.set(link.page_id, list);
  }
  // The four 2026 voter documents are presented in the 2026 block above. Keep
  // their rows out of the legacy article lists so each appears once on the
  // page; the masthead still counts every document in the archive.
  const articleDocuments = documents.filter(
    (document) => !isMovedVoterGuide2026(document.drive_id)
  );
  const documentsByPage = new Map<string, typeof documents>();
  for (const document of articleDocuments) {
    const list = documentsByPage.get(document.source_page_path) ?? [];
    list.push(document);
    documentsByPage.set(document.source_page_path, list);
  }
  const imageCount = assets.filter((asset) => asset.kind === 'image').length;
  const videoCount = assets.filter((asset) => asset.kind === 'youtube').length;
  const lastCaptured = pages
    .map((page) => page.captured_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <ArchiveMasthead
        pages={pages}
        documents={documents}
        imageCount={imageCount}
        videoCount={videoCount}
        lastCaptured={lastCaptured}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/*
          The 2026 voter guides sit outside the legacy branch on purpose. They are
          the moved content Erin asked for, and an empty or failed legacy capture
          must leave them rendered above the "being prepared" notice rather than
          hiding them behind it. With legacy pages present the layout is unchanged:
          the nav takes the narrow column and the guides lead the wide one.
        */}
        <div
          className={
            pages.length === 0
              ? 'space-y-12'
              : 'grid grid-cols-1 lg:grid-cols-[15rem_1fr] gap-10 items-start'
          }
        >
          {pages.length > 0 ? <ArchiveNav pages={pages} /> : null}

          <div className="space-y-12">
            <CopyRegion id="archive-voter-guides">
              <VoterGuidesSection dataPoints={dataPoints} legacyHref={legacyHref} mode="2026" />
            </CopyRegion>

            {pages.length === 0 ? (
              <ArchiveEmptyState />
            ) : (
              pages.map((page, pageIndex) => (
                <ArchiveArticle
                  key={page.id}
                  page={page}
                  pageIndex={pageIndex}
                  assets={assetsByPage.get(page.source_path) ?? []}
                  links={linksByPage.get(page.id) ?? []}
                  documents={documentsByPage.get(page.source_path) ?? []}
                />
              ))
            )}
          </div>
        </div>

        {pages.length > 0 ? <ArchiveFooter /> : null}
      </div>
    </div>
  );
}
