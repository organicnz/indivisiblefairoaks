import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ResultsSummaryFrameProps = {
  /** The already-formatted, human-readable result status. */
  message: ReactNode;
  onClear?: () => void;
  clearLabel?: string;
  className?: string;
};

/**
 * Shared status row for filtered archives: one live region for the count and
 * one optional reset action. Keeping the announcement and the reset together
 * stops the news and bulletin archives from growing different wording or
 * button behaviour as their filters evolve.
 */
export function ResultsSummaryFrame({
  message,
  onClear,
  clearLabel = 'Clear filters',
  className,
}: ResultsSummaryFrameProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center justify-between gap-2',
        className
      )}
    >
      <p
        aria-live="polite"
        aria-atomic="true"
        role="status"
        className="min-w-0 break-words text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-ink-muted-on-dark"
      >
        {message}
      </p>
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-8 shrink-0 items-center gap-1 border border-border bg-surface-card px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-primary hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:text-primary-on-dark"
        >
          <X size={11} aria-hidden="true" />
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
}
