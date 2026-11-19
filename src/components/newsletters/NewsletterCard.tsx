'use client';

import { Archive, ArrowRight, FileText, PenLine, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { NewsletterTopicPills } from '@/components/newsletters/NewsletterTopicPills';
import { DataPoint } from '@/components/ui/DataPoint';
import { HighlightedText } from '@/components/ui/HighlightedText';
import { NewsSearchExcerpt } from '@/components/ui/NewsSearchExcerpt';
import { NEWSLETTER_CARD_EXCERPT_LENGTH } from '@/lib/news-text';
import type { NewsletterRow } from '@/lib/queries/civic';

type NewsletterCardProps = {
  newsletter: NewsletterRow;
  dataPoints: Record<string, string>;
  isAdmin: boolean;
  onEdit: (newsletter: NewsletterRow) => void;
  onDelete: (slug: string, title: string) => void;
  searchQuery?: string;
};

export function NewsletterCard({
  newsletter,
  dataPoints,
  isAdmin,
  onEdit,
  onDelete,
  searchQuery,
}: NewsletterCardProps) {
  const pdfUrl = newsletter.pdf_url?.trim() || null;
  const archiveUrl = newsletter.archive_url?.trim() || null;
  const hasFullIssue = Boolean(newsletter.body?.trim() || pdfUrl || archiveUrl);

  return (
    <article className="civic-panel civic-card-lift flex flex-col justify-between p-5 hover:border-primary/40">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-primary-ink dark:text-accent-gold">
            <HighlightedText text={newsletter.date_label} query={searchQuery} />
          </span>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground dark:text-ink-muted-on-dark">
              <DataPoint name="news.bulletin_tag" as="span" initialData={dataPoints}>
                Chapter Bulletin
              </DataPoint>
            </span>

            {isAdmin ? (
              <div className="ml-1 inline-flex items-center gap-2 border border-border bg-surface-muted px-2 py-0.5">
                <button
                  type="button"
                  onClick={() => onEdit(newsletter)}
                  className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-bold text-accent-gold transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
                  title="Edit this bulletin"
                >
                  <PenLine size={11} aria-hidden="true" />
                  <DataPoint name="news.admin.btn_edit" as="span" initialData={dataPoints}>
                    Edit
                  </DataPoint>
                </button>
                <span className="text-white/20" aria-hidden="true">
                  |
                </span>
                <ConfirmAction
                  label={`Delete bulletin ${newsletter.title}`}
                  message={`Delete bulletin "${newsletter.title}" from archives?`}
                  danger
                  onConfirm={() => onDelete(newsletter.slug, newsletter.title)}
                  idleClassName="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <Trash2 size={11} aria-hidden="true" />
                  <DataPoint name="news.admin.btn_delete" as="span" initialData={dataPoints}>
                    Delete
                  </DataPoint>
                </ConfirmAction>
              </div>
            ) : null}
          </div>
        </div>

        <h3 className="font-display text-2xl font-semibold leading-snug tracking-[-0.02em]">
          <Link
            href={`/newsletters/${newsletter.slug}`}
            className="transition-colors hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:text-primary-on-dark"
          >
            <HighlightedText text={newsletter.title} query={searchQuery} />
          </Link>
        </h3>
        {newsletter.description ? (
          <p className="text-xs leading-relaxed text-muted-foreground dark:text-ink-on-dark">
            <NewsSearchExcerpt
              text={newsletter.description}
              query={searchQuery}
              maxLength={NEWSLETTER_CARD_EXCERPT_LENGTH}
            />
          </p>
        ) : null}
        <NewsletterTopicPills topics={newsletter.topics} query={searchQuery} />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 dark:border-white/10">
        <Link
          href={`/newsletters/${newsletter.slug}`}
          className="flex min-h-6 items-center gap-1 rounded-xs text-xs font-bold text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-on-dark"
        >
          {hasFullIssue ? (
            <DataPoint name="news.read_bulletin" as="span" initialData={dataPoints}>
              Read Full Issue
            </DataPoint>
          ) : (
            <span>Read Summary</span>
          )}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>

        {pdfUrl || archiveUrl ? (
          <div className="flex flex-wrap items-center justify-end gap-3 text-[11px] font-bold text-muted-foreground dark:text-ink-muted-on-dark">
            {pdfUrl ? (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-6 items-center gap-1 hover:text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:text-primary-on-dark"
              >
                <FileText size={12} aria-hidden="true" />
                PDF
              </a>
            ) : null}
            {archiveUrl ? (
              <a
                href={archiveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-6 items-center gap-1 hover:text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:text-primary-on-dark"
              >
                <Archive size={12} aria-hidden="true" />
                Archive
              </a>
            ) : null}
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground dark:text-ink-muted-on-dark">
            On-site issue
          </span>
        )}
      </div>
    </article>
  );
}
