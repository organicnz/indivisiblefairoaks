'use client';

import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type NewsSearchVariant = 'news' | 'newsletter' | 'admin';

const VARIANT_STYLES: Record<
  NewsSearchVariant,
  { icon: string; input: string; clear: string }
> = {
  news: {
    icon: 'left-3 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-ink-muted-on-dark',
    input:
      'min-h-11 w-full border border-border bg-surface-card py-2 pl-9 pr-9 text-xs text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
    clear:
      'right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
  },
  newsletter: {
    icon: 'left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-ink-muted-on-dark',
    input:
      'w-full border border-border bg-surface-muted py-2.5 pl-10 pr-10 text-xs text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:text-sm dark:border-white/10 dark:text-white',
    clear:
      'right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-surface-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
  },
  admin: {
    icon: 'left-3 top-1/2 -translate-y-1/2 text-muted-foreground',
    input:
      'w-full rounded-xl border border-border bg-background py-1.5 pl-9 pr-9 text-xs focus:outline-none focus:ring-2 focus:ring-primary',
    clear:
      'right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
  },
};

type NewsSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  variant?: NewsSearchVariant;
  testId?: string;
  className?: string;
  iconSize?: number;
  clearLabel?: string;
};

/** One controlled search field for the news page, archive and admin manager. */
export function NewsSearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  variant = 'news',
  testId,
  className,
  iconSize = 14,
  clearLabel = 'Clear search',
}: NewsSearchFieldProps) {
  const styles = VARIANT_STYLES[variant];
  return (
    <div className={cn('relative', className)}>
      <Search
        className={cn('absolute pointer-events-none', styles.icon)}
        size={iconSize}
        aria-hidden="true"
      />
      <input
        type="search"
        aria-label={ariaLabel}
        data-testid={testId}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={styles.input}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={clearLabel}
          className={cn('absolute', styles.clear)}
        >
          <X size={13} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
