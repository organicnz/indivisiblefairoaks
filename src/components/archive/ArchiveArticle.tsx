import {
  ArrowUpRight,
  CalendarDays,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Lock,
  Newspaper,
  Play,
} from 'lucide-react';
import Image from 'next/image';
import {
  type LegacyAssetRow,
  type LegacyDocumentRow,
  type LegacyPageLinkRow,
  type LegacyPageRow,
  legacyAssetUrl,
  legacyDocumentUrl,
} from '@/lib/queries/legacy';
import { LiteYouTube } from '@/components/ui/LiteYouTube';
import { dateLabel, formatBytes, hostLabel, pageAnchor } from './archive-format';

type ArchiveArticleProps = {
  page: LegacyPageRow;
  pageIndex: number;
  assets: LegacyAssetRow[];
  links: LegacyPageLinkRow[];
  documents: LegacyDocumentRow[];
};

export function ArchiveArticle({
  page,
  pageIndex,
  assets,
  links,
  documents: pageDocuments,
}: ArchiveArticleProps) {
  const pageLinks = links.filter(
    (link) => link.href.startsWith('http') || link.href.startsWith('mailto:')
  );
  const images = assets.filter((asset) => asset.kind === 'image');
  const videos = assets.filter((asset) => asset.kind === 'youtube');

  return (
    <article
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
}
