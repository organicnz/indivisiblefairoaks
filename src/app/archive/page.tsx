import {
  Archive,
  ArrowUpRight,
  CalendarDays,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Lock,
  Newspaper,
  Play,
  ShieldCheck,
} from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { LiteYouTube } from '@/components/ui/LiteYouTube';
import { pageMetadata } from '@/lib/metadata';
import { getLegacyArchive, legacyAssetUrl, legacyDocumentUrl } from '@/lib/queries/legacy';

export const metadata: Metadata = pageMetadata({
  title: 'Chapter Archive',
  description:
    'Preserved public material from the chapter’s legacy Google Sites: voter guides, newsletters, event flyers, choir films, and historical organizing links.',
  path: '/archive',
});

function formatBytes(value: number | null): string {
  if (!value) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function dateLabel(value: string | null): string {
  if (!value) return 'Date not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not recorded';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function pageAnchor(sourcePath: string): string {
  return sourcePath === '/' ? 'home' : sourcePath.replace(/^\/+/, '').replace(/[^a-z0-9]+/gi, '-');
}

function hostLabel(value: string | null): string {
  if (!value) return 'Source';
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return 'Source';
  }
}

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
      <PageMasthead
        icon={Archive}
        eyebrow="Legacy Google Sites Archive"
        title={<h1 className={MASTHEAD_TITLE}>Chapter Archive</h1>}
        intro={
          <p className={MASTHEAD_INTRO}>
            The public record of our earlier Google Sites — voter guides, newsletters, event flyers,
            choir films, and the links we used to organize. Raw site captures and uncleared files stay
            in a private preservation archive.
          </p>
        }
        meta={
          pages.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {[
                `${pages.length} pages`,
                `${documents.length} documents`,
                `${imageCount} images`,
                `${videoCount} videos`,
              ].map((label) => (
                <span key={label} className="civic-stamp">
                  {label}
                </span>
              ))}
              {lastCaptured ? (
                <span className="text-[11px] text-muted-foreground">
                  Captured {dateLabel(lastCaptured)}
                </span>
              ) : null}
            </div>
          ) : undefined
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {pages.length === 0 ? (
          <div className="border-y border-border bg-surface-card p-8 text-center sm:p-12">
            <Archive className="mx-auto text-accent-gold" size={32} />
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.03em]">
              The archive is being prepared
            </h2>
            <p className="mt-2 max-w-xl mx-auto text-sm text-muted-foreground dark:text-ink-on-dark leading-relaxed">
              The public index will appear after the legacy migration is applied and the read-only
              capture has been reviewed. The original pages are still available on{' '}
              <a
                href="https://sites.google.com/indivisiblefairoaks.org/indivisiblefairoaks/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary-ink dark:text-primary-on-dark hover:underline"
              >
                the old Google Sites
              </a>
              .
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[15rem_1fr] gap-10 items-start">
            <nav
              aria-label="Archive pages"
              className="border-y border-border bg-surface-card p-4 lg:sticky lg:top-28"
            >
              <p className="civic-meta px-2">
                On this page
              </p>
              <ol className="mt-3 space-y-1">
                {pages.map((page, index) => (
                  <li key={page.id}>
                    <a
                      href={`#${pageAnchor(page.source_path)}`}
                      className="flex items-start gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-foreground/80 dark:text-ink-on-dark hover:bg-surface-muted hover:text-primary-ink dark:hover:text-accent-gold transition-colors"
                    >
                      <span className="font-mono text-[10px] text-muted-foreground pt-0.5">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span>{page.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
              <div className="mt-4 border-t border-border pt-4 px-2 text-[11px] leading-relaxed text-muted-foreground dark:text-ink-muted-on-dark">
                <ShieldCheck size={14} className="inline mr-1 text-accent-gold" />
                Approved public rows only. Private captures are not linked from this page.
              </div>
            </nav>

            <div className="space-y-12">
              {pages.map((page, pageIndex) => {
                const pageAssets = assetsByPage.get(page.source_path) ?? [];
                const pageLinks = (linksByPage.get(page.id) ?? []).filter(
                  (link) => link.href.startsWith('http') || link.href.startsWith('mailto:')
                );
                const pageDocuments = documentsByPage.get(page.source_path) ?? [];
                const images = pageAssets.filter((asset) => asset.kind === 'image');
                const videos = pageAssets.filter((asset) => asset.kind === 'youtube');
                return (
                  <article
                    key={page.id}
                    id={pageAnchor(page.source_path)}
                    className="scroll-mt-28 border-y border-border bg-surface-card p-6 sm:p-8"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-border pb-5">
                      <div>
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground dark:text-ink-muted-on-dark">
                          <span className="font-mono">Page {String(pageIndex + 1).padStart(2, '0')}</span>
                          <span>•</span>
                          <span>{page.page_kind.replace(/-/g, ' ')}</span>
                        </div>
                        <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                          {page.title}
                        </h2>
                        <p className="mt-1 text-xs text-muted-foreground dark:text-ink-muted-on-dark">
                          <CalendarDays size={12} className="inline mr-1" />
                          {dateLabel(page.captured_at)} · <span className="font-mono">{page.source_path}</span>
                        </p>
                      </div>
                      <a
                        href={page.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground hover:border-primary/40 hover:text-primary-ink dark:text-ink-on-dark dark:hover:text-accent-gold transition-colors shrink-0"
                      >
                        Original page
                        <ArrowUpRight size={14} />
                      </a>
                    </div>

                    {!page.body_text && page.summary ? (
                      <p className="mt-5 text-sm sm:text-base text-muted-foreground dark:text-ink-on-dark leading-relaxed break-words">
                        {page.summary}
                      </p>
                    ) : null}

                    {page.body_text ? (
                      <div className="mt-5 border-l-2 border-accent bg-surface-muted/60 p-4 text-sm leading-relaxed text-foreground/85 whitespace-pre-line break-words sm:p-5">
                        {page.body_text}
                      </div>
                    ) : null}

                    {images.length > 0 ? (
                      <div className="mt-6">
                        <h3 className="civic-meta flex items-center gap-2">
                          <ImageIcon size={14} className="text-accent-gold" />
                          Images from this page
                        </h3>
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {images.map((asset) => {
                            const src = legacyAssetUrl(asset);
                            if (!src) return null;
                            return (
                              <figure
                                key={asset.id}
                                className="overflow-hidden rounded-xl border border-border bg-surface-muted"
                              >
                                <Image
                                  src={src}
                                  alt={asset.alt_text || asset.caption || `${page.title} archive image`}
                                  width={asset.width && asset.width > 0 ? asset.width : 640}
                                  height={asset.height && asset.height > 0 ? asset.height : 360}
                                  loading="lazy"
                                  unoptimized
                                  className="h-32 w-full object-contain p-1"
                                />
                                {asset.caption || asset.alt_text ? (
                                  <figcaption className="px-2 py-1.5 text-[10px] leading-snug text-muted-foreground dark:text-ink-muted-on-dark line-clamp-2">
                                    {asset.caption || asset.alt_text}
                                  </figcaption>
                                ) : null}
                              </figure>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {videos.length > 0 ? (
                      <div className="mt-6">
                        <h3 className="civic-meta flex items-center gap-2">
                          <Play size={14} className="text-accent-gold" />
                          Video
                        </h3>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {videos.map((asset) =>
                            asset.youtube_id ? (
                              <div key={asset.id} className="overflow-hidden border border-border bg-surface-deep">
                                <LiteYouTube
                                  videoId={asset.youtube_id}
                                  title={
                                    asset.caption && asset.caption.trim() !== 'YouTube Video'
                                      ? asset.caption
                                      : `${page.title} archive video`
                                  }
                                  poster="/images/gallery/sacramento-capitol-no-kings.jpg"
                                />
                                {asset.caption ? (
                                  <p className="p-2 text-[11px] text-muted-foreground dark:text-ink-muted-on-dark">
                                    {asset.caption}
                                  </p>
                                ) : null}
                              </div>
                            ) : null
                          )}
                        </div>
                      </div>
                    ) : null}

                    {pageDocuments.length > 0 ? (
                      <div className="mt-6">
                        <h3 className="civic-meta flex items-center gap-2">
                          <FileText size={14} className="text-accent-gold" />
                          Documents &amp; downloads
                        </h3>
                        <ul className="mt-3 divide-y divide-border rounded-xl border border-border overflow-hidden">
                          {pageDocuments.map((document) => {
                            const href = legacyDocumentUrl(document);
                            const hosted = Boolean(document.file_path || document.public_url);
                            return (
                              <li
                                key={document.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-muted/40 px-4 py-3"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-foreground dark:text-white leading-snug">
                                    {document.title}
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-muted-foreground dark:text-ink-muted-on-dark">
                                    {document.mime_type || 'File'} · {formatBytes(document.byte_size)} ·{' '}
                                    {hosted ? 'Hosted copy' : 'Links to original source'}
                                  </p>
                                </div>
                                {href ? (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-primary-dark transition-colors"
                                  >
                                    {hosted ? <FileText size={12} /> : <ExternalLink size={12} />}
                                    {hosted ? 'Download' : 'Open source'}
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Lock size={12} /> Source unavailable
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}

                    {pageLinks.length > 0 ? (
                      <div className="mt-6 border-t border-border pt-5">
                        <h3 className="civic-meta flex items-center gap-2">
                          <Newspaper size={14} className="text-accent-gold" />
                          Links preserved from this page
                        </h3>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {pageLinks.map((link) => (
                            <a
                              key={link.id}
                              href={link.href}
                              target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                              rel={link.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-[11px] font-semibold text-foreground/80 hover:border-primary/40 hover:text-primary-ink dark:text-ink-on-dark dark:hover:text-accent-gold transition-colors"
                            >
                              <span className="truncate max-w-[18rem]">
                                {link.label || hostLabel(link.href)}
                              </span>
                              <ExternalLink size={11} className="shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {pages.length > 0 ? (
          <div className="mt-12 flex flex-col items-start justify-between gap-4 border-y border-border bg-surface-muted/50 p-5 sm:flex-row sm:items-center sm:p-6">
            <div>
              <p className="text-sm font-bold text-foreground dark:text-white">Looking for a specific old page?</p>
              <p className="mt-1 text-xs text-muted-foreground dark:text-ink-on-dark">
                The archive index above is complete for the preserved public pages. Raw captures remain
                private while rights and file integrity are reviewed.
              </p>
            </div>
            <Link
              href="/contact"
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 border border-primary bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark"
            >
              Ask the chapter
              <ArrowUpRight size={14} />
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
