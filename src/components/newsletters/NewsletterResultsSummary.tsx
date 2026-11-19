import { ALL_NEWSLETTER_TOPICS, displayNewsQuery, isAllNewsletterTopics } from '@/lib/news-text';

type NewsletterResultsSummaryProps = {
  shown: number;
  total: number;
  query: string;
  activeTopic: string;
  allTopicsLabel?: string;
};

/** Explain a narrowed archive, including topic-only filters. */
export function NewsletterResultsSummary({
  shown,
  total,
  query,
  activeTopic,
  allTopicsLabel = ALL_NEWSLETTER_TOPICS,
}: NewsletterResultsSummaryProps) {
  const trimmed = displayNewsQuery(query);
  const topicFiltered = Boolean(activeTopic.trim()) && !isAllNewsletterTopics(activeTopic, allTopicsLabel);
  if (!trimmed && !topicFiltered) return null;

  return (
    <p
      aria-live="polite"
      aria-atomic="true"
      role="status"
      className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-ink-muted-on-dark"
    >
      Showing {shown} of {total} {total === 1 ? 'bulletin' : 'bulletins'}
      {trimmed ? ` matching “${trimmed}”` : ''}
      {topicFiltered ? ` in ${activeTopic}` : ''}.
    </p>
  );
}
