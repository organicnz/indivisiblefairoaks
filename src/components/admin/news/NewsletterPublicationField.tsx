import { CalendarClock, Clock3 } from 'lucide-react';
import { NewsFieldHeader } from '@/components/admin/news/NewsFieldHeader';
import { formatPacificDateTime, pacificWallToInstant } from '@/lib/calendar-time';

type NewsletterPublicationFieldProps = {
  publishedAt: string;
  scheduled: boolean;
  onPublishedAtChange: (value: string) => void;
  onUseCurrentTime: () => void;
};

export function NewsletterPublicationField({
  publishedAt,
  scheduled,
  onPublishedAtChange,
  onUseCurrentTime,
}: NewsletterPublicationFieldProps) {
  const publicationInstant = publishedAt
    ? pacificWallToInstant(publishedAt)
    : new Date().toISOString();
  const publicationTime =
    formatPacificDateTime(publicationInstant) ?? 'Choose a valid Pacific date and time';

  return (
    <div className="rounded-sm border border-border bg-surface-muted/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <NewsFieldHeader label="Publication time (Pacific)" htmlFor="civic-news-published-at" />
          <input
            id="civic-news-published-at"
            type="datetime-local"
            value={publishedAt}
            onChange={(event) => onPublishedAtChange(event.target.value)}
            className="min-h-10 w-full rounded-sm border border-border bg-background px-3 py-2 text-xs font-medium transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <button
          type="button"
          onClick={onUseCurrentTime}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-border bg-background px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Clock3 size={14} aria-hidden="true" />
          Use now
        </button>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
        {scheduled
          ? `Scheduled for ${publicationTime}. It stays out of the public archive until then.`
          : `Publishes immediately (${publicationTime}). A future time schedules it instead.`}
      </p>
    </div>
  );
}
