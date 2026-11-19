import { CalendarClock, Check, Eye } from 'lucide-react';
import { NewsletterTopicPills } from '@/components/newsletters/NewsletterTopicPills';

type NewsletterPreviewCardProps = {
  dateLabel: string;
  title: string;
  description: string;
  topics: string[];
  scheduled: boolean;
};

export function NewsletterPreviewCard({
  dateLabel,
  title,
  description,
  topics,
  scheduled,
}: NewsletterPreviewCardProps) {
  return (
    <aside
      aria-label="Public archive preview"
      className="border-t border-border bg-surface-muted/30 p-5 sm:p-6 lg:border-l lg:border-t-0"
    >
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
        <Eye size={14} aria-hidden="true" />
        Public card preview
      </div>
      <div className="mt-3 border border-border bg-surface-card p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary-ink dark:text-accent-gold">
            {dateLabel || 'Issue date'}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Chapter bulletin
          </span>
        </div>
        <h3 className="mt-3 font-display text-2xl font-semibold leading-snug tracking-[-0.02em]">
          {title || 'Bulletin title'}
        </h3>
        <p className="mt-2 line-clamp-6 text-xs leading-relaxed text-muted-foreground">
          {description || 'A short summary of this bulletin will appear here.'}
        </p>
        <NewsletterTopicPills topics={topics} variant="preview" />
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-3 text-[10px] font-bold text-muted-foreground">
          <span>Request full issue</span>
          <span>PDF &amp; email archive</span>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-[11px] leading-relaxed text-muted-foreground">
        <p className="inline-flex items-center gap-1.5 font-bold text-foreground">
          {scheduled ? (
            <>
              <CalendarClock size={13} aria-hidden="true" />
              Scheduled
            </>
          ) : (
            <>
              <Check size={13} aria-hidden="true" />
              Publishes now
            </>
          )}
        </p>
        <p>
          This is the card readers see at{' '}
          <span className="font-mono text-[10px]">/newsletters</span>. It uses the same fields the
          public archive renders.
        </p>
      </div>
    </aside>
  );
}
