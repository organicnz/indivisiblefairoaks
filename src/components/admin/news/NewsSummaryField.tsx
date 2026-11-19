import { Sparkles, Wand2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { NewsFieldHeader } from '@/components/admin/news/NewsFieldHeader';
import { NewsTextReview } from '@/components/admin/news/NewsTextReview';
import { NewsTextStats } from '@/components/admin/news/NewsTextStats';
import { inspectNewsText } from '@/lib/news-text';
import { cn } from '@/lib/utils';

type GeneratedSummaryAction = {
  onUse: () => void;
  label?: string;
};

type NewsSummaryFieldProps = {
  /** Stable id used by the label, help copy, and textarea. */
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  /** How much of the summary the public card can show before it clamps. */
  cardLength: number;
  help: ReactNode;
  rows?: number;
  required?: boolean;
  placeholder?: string;
  generatedSummary?: GeneratedSummaryAction;
  className?: string;
};

/**
 * The one summary editor used by bulletins and news posts.
 *
 * Counting, live readability statistics, paste cleanup, the optional generated
 * summary action and the editorial review used to be copied into each editor.
 * Keeping them here means a new summary field gets the same affordances, the
 * same accessible description, and the same advice without another bespoke
 * implementation.
 */
export function NewsSummaryField({
  id,
  label,
  value,
  onChange,
  maxLength,
  cardLength,
  help,
  rows = 4,
  required = false,
  placeholder,
  generatedSummary,
  className,
}: NewsSummaryFieldProps) {
  const { analysis, suggestions, tidied, canTidy } = inspectNewsText(value, { cardLength });
  const helpId = `${id}-help`;
  const reviewId = `${id}-review`;
  const describedBy = value.trim() ? `${helpId} ${reviewId}` : helpId;

  return (
    <div className={cn(className)}>
      <NewsFieldHeader
        label={label}
        htmlFor={id}
        required={required}
        count={`${value.length}/${maxLength} chars`}
      />

      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        rows={rows}
        placeholder={placeholder}
        required={required}
        aria-describedby={describedBy}
        className="w-full resize-y rounded-sm border border-border bg-background px-3.5 py-2.5 text-sm font-medium leading-relaxed transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />

      <div className="mt-1 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <p
          id={helpId}
          className="min-w-0 flex-1 basis-48 break-words text-[10px] leading-relaxed text-muted-foreground"
        >
          {help}
          {analysis.words > 0 ? (
            <>
              {' '}
              <NewsTextStats analysis={analysis} />
            </>
          ) : null}
        </p>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {generatedSummary ? (
            <button
              type="button"
              onClick={generatedSummary.onUse}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-primary-ink transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-on-dark"
            >
              <Wand2 size={11} aria-hidden="true" />
              {generatedSummary.label ?? 'Use generated'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onChange(tidied)}
            disabled={!canTidy}
            title="Normalize line breaks and repeated spaces without changing the wording"
            aria-label="Tidy summary spacing"
            className="inline-flex items-center gap-1 text-[10px] font-bold text-primary-ink transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40 dark:text-primary-on-dark"
          >
            <Sparkles size={11} aria-hidden="true" />
            Tidy spacing
          </button>
        </div>
      </div>

      <NewsTextReview id={reviewId} value={value} suggestions={suggestions} />
    </div>
  );
}
