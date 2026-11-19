'use client';

import { Clock3, Mail, Newspaper, Pencil, Trash2 } from 'lucide-react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { NewsletterTopicPills } from '@/components/newsletters/NewsletterTopicPills';
import { HighlightedText } from '@/components/ui/HighlightedText';
import { NewsSearchExcerpt } from '@/components/ui/NewsSearchExcerpt';
import type { CivicNewsletterRecord } from '@/lib/actions/civic';
import { NEWSLETTER_CARD_EXCERPT_LENGTH } from '@/lib/news-text';
import { newsletterPublicationLabel } from '@/lib/newsletters';

type NewsletterManagerRowProps = {
  newsletter: CivicNewsletterRecord;
  searchQuery?: string;
  onEdit: (newsletter: CivicNewsletterRecord) => void;
  onEmail: (newsletter: CivicNewsletterRecord) => void;
  onDelete: (slug: string) => void;
};

function NewsletterStatusBadge({ publishedAt }: { publishedAt: string | null }) {
  const label = newsletterPublicationLabel(publishedAt);
  if (label === 'Scheduled') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">
        <Clock3 size={9} aria-hidden="true" />
        Scheduled
      </span>
    );
  }
  return (
    <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200">
      Published
    </span>
  );
}

export function NewsletterManagerRow({
  newsletter,
  searchQuery,
  onEdit,
  onEmail,
  onDelete,
}: NewsletterManagerRowProps) {
  return (
    <div className="group flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-surface-card p-4 shadow-2xs transition-all hover:border-primary/40 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3.5">
        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-secondary text-primary-on-dark dark:bg-slate-800">
          <Newspaper size={18} aria-hidden="true" />
        </div>
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary-ink dark:text-primary-on-dark">
              <HighlightedText text={newsletter.date_label} query={searchQuery} />
            </span>
            <NewsletterStatusBadge publishedAt={newsletter.published_at} />
          </div>
          <h4 className="text-sm font-bold text-foreground transition-colors group-hover:text-primary">
            <HighlightedText text={newsletter.title} query={searchQuery} />
          </h4>
          {newsletter.description ? (
            <p className="mt-1 line-clamp-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
              <NewsSearchExcerpt
                text={newsletter.description}
                query={searchQuery}
                maxLength={NEWSLETTER_CARD_EXCERPT_LENGTH}
              />
            </p>
          ) : null}
          <NewsletterTopicPills topics={newsletter.topics} query={searchQuery} variant="admin" />
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 self-end sm:self-center">
        <button
          type="button"
          onClick={() => onEmail(newsletter)}
          title={`Email ${newsletter.title} to confirmed subscribers`}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Mail size={12} aria-hidden="true" />
          <span>Email</span>
        </button>
        <button
          type="button"
          onClick={() => onEdit(newsletter)}
          title="Edit newsletter"
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Pencil size={12} aria-hidden="true" />
          <span>Edit</span>
        </button>
        <ConfirmAction
          label={`Delete newsletter ${newsletter.title}`}
          message={`Delete newsletter "${newsletter.title}"? This cannot be undone.`}
          danger
          confirmLabel="Delete"
          onConfirm={() => onDelete(newsletter.slug)}
          idleClassName="p-1.5 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          <Trash2 size={14} aria-hidden="true" />
        </ConfirmAction>
      </div>
    </div>
  );
}
