'use client';

import { Sparkles, Wand2 } from 'lucide-react';
import { NewsletterTextStats } from '@/components/admin/news/NewsletterTextStats';
import { analyzeNewsletterText, tidyNewsletterText } from '@/lib/news-text';
import { CONTENT_EXCERPT_MAX } from '@/lib/content';

type ContentExcerptFieldProps = {
  excerpt: string;
  derivedExcerpt: string;
  onChange: (value: string) => void;
  onUseGeneratedSummary: () => void;
};

/**
 * The editable card summary. It is deliberately separate from the SEO meta
 * description: one is the sentence readers see on `/news` cards, the other is
 * the search-result snippet. Both can be generated, but only one belongs on the
 * card.
 */
export function ContentExcerptField({
  excerpt,
  derivedExcerpt,
  onChange,
  onUseGeneratedSummary,
}: ContentExcerptFieldProps) {
  const analysis = analyzeNewsletterText(excerpt);
  const tidied = tidyNewsletterText(excerpt);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <label
          htmlFor="content-excerpt"
          className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground"
        >
          Card summary / excerpt
        </label>
        <span className="font-mono text-[10px] text-muted-foreground">
          {excerpt.length}/{CONTENT_EXCERPT_MAX} chars
        </span>
      </div>
      <textarea
        id="content-excerpt"
        value={excerpt}
        onChange={(event) => onChange(event.target.value)}
        maxLength={CONTENT_EXCERPT_MAX}
        rows={3}
        placeholder={derivedExcerpt || 'A short summary for the news card.'}
        aria-describedby="content-excerpt-help"
        className="w-full resize-y rounded-lg border border-border bg-surface-card px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      <div className="mt-1 flex items-start justify-between gap-3">
        <p
          id="content-excerpt-help"
          className="text-[10px] leading-relaxed text-muted-foreground"
        >
          Shown on the news card. The SEO description controls search results.{' '}
          {analysis.words > 0 ? <NewsletterTextStats analysis={analysis} /> : null}
        </p>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {derivedExcerpt ? (
            <button
              type="button"
              onClick={onUseGeneratedSummary}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-primary-ink transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-on-dark"
            >
              <Wand2 size={11} aria-hidden="true" />
              Use generated
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onChange(tidied)}
            disabled={!excerpt.trim() || tidied === excerpt}
            title="Normalize line breaks and repeated spaces without changing the wording"
            aria-label="Tidy summary spacing"
            className="inline-flex items-center gap-1 text-[10px] font-bold text-primary-ink transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40 dark:text-primary-on-dark"
          >
            <Sparkles size={11} aria-hidden="true" />
            Tidy spacing
          </button>
        </div>
      </div>
    </div>
  );
}
