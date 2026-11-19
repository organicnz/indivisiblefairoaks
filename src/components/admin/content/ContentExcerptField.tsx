'use client';

import { NewsSummaryField } from '@/components/admin/news/NewsSummaryField';
import { CONTENT_CARD_EXCERPT_LENGTH, CONTENT_EXCERPT_MAX } from '@/lib/content';

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
  return (
    <NewsSummaryField
      id="content-excerpt"
      label="Card summary / excerpt"
      value={excerpt}
      onChange={onChange}
      maxLength={CONTENT_EXCERPT_MAX}
      cardLength={CONTENT_CARD_EXCERPT_LENGTH}
      rows={3}
      placeholder={derivedExcerpt || 'A short summary for the news card.'}
      help="Shown on the news card. The SEO description controls search results."
      generatedSummary={
        derivedExcerpt
          ? { onUse: onUseGeneratedSummary, label: 'Use generated' }
          : undefined
      }
    />
  );
}
