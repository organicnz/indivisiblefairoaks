import type { Metadata } from 'next';
import { ArchiveArticle } from '@/components/archive/ArchiveArticle';
import { ArchiveEmptyState } from '@/components/archive/ArchiveEmptyState';
import { ArchiveFooter } from '@/components/archive/ArchiveFooter';
import { ArchiveMasthead } from '@/components/archive/ArchiveMasthead';
import { ArchiveNav } from '@/components/archive/ArchiveNav';
import { pageMetadata } from '@/lib/metadata';
import { getLegacyArchive } from '@/lib/queries/legacy';

export const metadata: Metadata = pageMetadata({
  title: 'Chapter Archive',
  description:
    'Preserved public material from the chapter’s legacy Google Sites: voter guides, newsletters, event flyers, choir films, and historical organizing links.',
  path: '/archive',
});

export default async function ArchivePage() {
  const { pages, assets, links, documents } = await getLegacyArchive();
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
  const documentsByPage = new Map<string, typeof documents>();
  for (const document of documents) {
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
        {pages.length === 0 ? (
          <ArchiveEmptyState />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[15rem_1fr] gap-10 items-start">
            <ArchiveNav pages={pages} />

            <div className="space-y-12">
              {pages.map((page, pageIndex) => (
                <ArchiveArticle
                  key={page.id}
                  page={page}
                  pageIndex={pageIndex}
                  assets={assetsByPage.get(page.source_path) ?? []}
                  links={linksByPage.get(page.id) ?? []}
                  documents={documentsByPage.get(page.source_path) ?? []}
                />
              ))}
            </div>
          </div>
        )}

        {pages.length > 0 ? <ArchiveFooter /> : null}
      </div>
    </div>
  );
}
