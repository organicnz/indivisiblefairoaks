import { cn } from '@/lib/utils';
import { displayNewsQuery } from '@/lib/news-text';

type SearchResultsSummaryProps = {
  count: number;
  query: string;
  singular: string;
  plural: string;
  className?: string;
};

/** Shared live result count for the two public archives. */
export function SearchResultsSummary({
  count,
  query,
  singular,
  plural,
  className,
}: SearchResultsSummaryProps) {
  const trimmed = displayNewsQuery(query);
  if (!trimmed) return null;

  return (
    <p
      aria-live="polite"
      aria-atomic="true"
      role="status"
      className={cn(
        'text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-ink-muted-on-dark',
        className
      )}
    >
      {count} {count === 1 ? singular : plural} matching “{trimmed}”
    </p>
  );
}
