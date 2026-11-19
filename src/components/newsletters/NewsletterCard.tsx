'use client';

import { ArrowRight, PenLine, Trash2 } from 'lucide-react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { DataPoint } from '@/components/ui/DataPoint';
import { HighlightedText } from '@/components/ui/HighlightedText';
import { buildNewsSearchSnippet } from '@/lib/news-text';
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
  const topics = Array.isArray(newsletter.topics) ? newsletter.topics : [];
  const description = searchQuery
    ? buildNewsSearchSnippet(newsletter.description, searchQuery, 220)
    : newsletter.description;

  return (
    <article className="civic-panel flex flex-col justify-between p-6 transition-colors hover:border-primary/40">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-primary-ink dark:text-accent-gold">
            {newsletter.date_label}
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
                  className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-bold text-accent-gold transition-colors hover:text-white"
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
                  idleClassName="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
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
          <HighlightedText text={newsletter.title} query={searchQuery} />
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground dark:text-ink-on-dark">
          <HighlightedText text={description} query={searchQuery} />
        </p>
        {topics.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {topics.map((topic, index) => (
              <span
                key={`${topic}-${index}`}
                className="border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground dark:text-ink-on-dark"
              >
                <HighlightedText text={topic} query={searchQuery} />
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-border pt-6 dark:border-white/10">
        <a
          href="mailto:contact@indivisiblefairoaks.org?subject=Archive%20Request%20-%20Bulletin"
          className="flex items-center gap-1 rounded-xs text-xs font-bold text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-on-dark"
        >
          <DataPoint name="news.read_bulletin" as="span" initialData={dataPoints}>
            Request Full Issue
          </DataPoint>
          <ArrowRight size={14} aria-hidden="true" />
        </a>
        <span className="text-[11px] text-muted-foreground dark:text-ink-muted-on-dark">
          PDF &amp; Email Archive
        </span>
      </div>
    </article>
  );
}
