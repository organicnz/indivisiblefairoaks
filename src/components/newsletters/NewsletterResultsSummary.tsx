import { ResultsSummaryFrame } from '@/components/ui/ResultsSummaryFrame';
import {
  ALL_NEWSLETTER_TOPICS,
  displayNewsQuery,
  isAllNewsletterTopics,
} from '@/lib/news-text';

type NewsletterResultsSummaryProps = {
  shown: number;
  total: number;
  query: string;
  activeTopic: string;
  allTopicsLabel?: string;
  onClearFilters?: () => void;
};

/** Explain and reset a narrowed bulletin archive, including topic-only filters. */
export function NewsletterResultsSummary({
  shown,
  total,
  query,
  activeTopic,
  allTopicsLabel = ALL_NEWSLETTER_TOPICS,
  onClearFilters,
}: NewsletterResultsSummaryProps) {
  const trimmed = displayNewsQuery(query);
  const topicFiltered =
    Boolean(activeTopic.trim()) && !isAllNewsletterTopics(activeTopic, allTopicsLabel);
  if (!trimmed && !topicFiltered) return null;

  const clearLabel =
    trimmed && topicFiltered
      ? 'Clear search and topic'
      : trimmed
        ? 'Clear search'
        : 'Show all topics';

  return (
    <ResultsSummaryFrame
      message={
        <>
          Showing {shown} of {total} {total === 1 ? 'bulletin' : 'bulletins'}
          {trimmed ? ` matching “${trimmed}”` : ''}
          {topicFiltered ? ` in ${activeTopic}` : ''}.
        </>
      }
      onClear={onClearFilters && shown > 0 ? onClearFilters : undefined}
      clearLabel={clearLabel}
    />
  );
}
