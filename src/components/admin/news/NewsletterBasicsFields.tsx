import { RotateCcw } from 'lucide-react';
import type { RefObject } from 'react';
import { NewsFieldHeader } from '@/components/admin/news/NewsFieldHeader';
import { NEWSLETTER_LIMITS, slugifyNewsletter } from '@/lib/newsletters';

type NewsletterBasicsFieldsProps = {
  title: string;
  slug: string;
  dateLabel: string;
  titleInputRef: RefObject<HTMLInputElement | null>;
  onTitleChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onDateLabelChange: (value: string) => void;
};

export function NewsletterBasicsFields({
  title,
  slug,
  dateLabel,
  titleInputRef,
  onTitleChange,
  onSlugChange,
  onDateLabelChange,
}: NewsletterBasicsFieldsProps) {
  const storedSlug = slugifyNewsletter(slug) || slugifyNewsletter(title) || 'auto-generated';

  return (
    <>
      <div>
        <NewsFieldHeader
          label="Bulletin title"
          htmlFor="civic-news-title"
          required
          count={`${title.length}/${NEWSLETTER_LIMITS.title}`}
        />
        <input
          ref={titleInputRef}
          id="civic-news-title"
          type="text"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          maxLength={NEWSLETTER_LIMITS.title}
          placeholder="e.g. Summer Action Bulletin & Town Hall Recap"
          required
          className="min-h-11 w-full rounded-sm border border-border bg-background px-3.5 py-2.5 text-sm font-semibold transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <NewsFieldHeader label="Public identifier" htmlFor="civic-news-slug" />
          <div className="flex items-center gap-2">
            <input
              id="civic-news-slug"
              type="text"
              value={slug}
              onChange={(event) => onSlugChange(event.target.value)}
              onBlur={() => {
                const normalized = slugifyNewsletter(slug);
                if (normalized && normalized !== slug) onSlugChange(normalized);
              }}
              maxLength={NEWSLETTER_LIMITS.slug}
              placeholder="auto-generated-from-title"
              aria-describedby="civic-news-slug-help"
              className="min-h-10 w-full rounded-sm border border-border bg-background px-3 py-2 font-mono text-xs transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={() => onSlugChange(slugifyNewsletter(title))}
              title="Generate the slug from the title"
              aria-label="Generate the public identifier from the title"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm border border-border bg-background text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <RotateCcw size={14} aria-hidden="true" />
            </button>
          </div>
          <p id="civic-news-slug-help" className="mt-1 truncate text-[10px] text-muted-foreground">
            Stored identifier:{' '}
            <span className="font-mono">{storedSlug}</span>
          </p>
        </div>

        <div>
          <NewsFieldHeader label="Issue / date label" htmlFor="civic-news-date-label" required />
          <input
            id="civic-news-date-label"
            type="text"
            value={dateLabel}
            onChange={(event) => onDateLabelChange(event.target.value)}
            maxLength={NEWSLETTER_LIMITS.dateLabel}
            placeholder="e.g. July 2026"
            required
            className="min-h-10 w-full rounded-sm border border-border bg-background px-3 py-2 text-sm font-medium transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            Printed above the title in the public archive.
          </p>
        </div>
      </div>
    </>
  );
}
