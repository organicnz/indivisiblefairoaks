import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { NEWSLETTER_CARD_EXCERPT_LENGTH, reviewNewsText } from '@/lib/news-text';
import { cn } from '@/lib/utils';

type NewsTextReviewProps = {
  value: string;
  /** How much of the summary the public card can show before it clamps. */
  cardLength?: number;
  className?: string;
  /** Optional id so the textarea can include the advice in aria-describedby. */
  id?: string;
};

/** Compact, non-blocking readability review shared by both summary editors. */
export function NewsTextReview({
  value,
  cardLength = NEWSLETTER_CARD_EXCERPT_LENGTH,
  className,
  id,
}: NewsTextReviewProps) {
  if (!value.trim()) return null;
  const suggestions = reviewNewsText(value, { cardLength });

  if (suggestions.length === 0) {
    return (
      <p
        id={id}
        aria-label="Summary suggestions"
        className={cn(
          'mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300',
          className
        )}
      >
        <CheckCircle2 size={12} aria-hidden="true" />
        Reads cleanly.
      </p>
    );
  }

  return (
    <ul id={id} aria-label="Summary suggestions" className={cn('mt-2 space-y-1', className)}>
      {suggestions.map((suggestion) => (
        <li
          key={suggestion.id}
          className={cn(
            'flex items-start gap-1.5 text-[10px] leading-relaxed',
            suggestion.tone === 'warning'
              ? 'text-amber-700 dark:text-amber-300'
              : 'text-muted-foreground'
          )}
        >
          {suggestion.tone === 'warning' ? (
            <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          ) : (
            <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          )}
          <span>{suggestion.message}</span>
        </li>
      ))}
    </ul>
  );
}
