import { ResultsSummaryFrame } from '@/components/ui/ResultsSummaryFrame';
import { displayNewsQuery } from '@/lib/news-text';

type SearchResultsSummaryProps = {
  count: number;
  query: string;
  singular: string;
  plural: string;
  className?: string;
  onClear?: () => void;
};

/** Shared live result count and reset action for news searches. */
export function SearchResultsSummary({
  count,
  query,
  singular,
  plural,
  className,
  onClear,
}: SearchResultsSummaryProps) {
  const trimmed = displayNewsQuery(query);
  if (!trimmed) return null;

  return (
    <ResultsSummaryFrame
      message={
        <>
          {count} {count === 1 ? singular : plural} matching “{trimmed}”
        </>
      }
      onClear={onClear && count > 0 ? onClear : undefined}
      clearLabel="Clear search"
      className={className}
    />
  );
}
