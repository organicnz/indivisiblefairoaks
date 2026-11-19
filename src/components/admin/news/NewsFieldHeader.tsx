import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type NewsFieldHeaderProps = {
  label: ReactNode;
  /** Usually a character count; the header stays compact when omitted. */
  count?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  /** Some field groups label an input that already owns its own aria-label. */
  as?: 'label' | 'span';
  className?: string;
};

/**
 * The small printed label row above an authoring control.
 *
 * The bulletin editor previously repeated this exact typography and counter
 * markup for titles, summaries, topics, sorting and publication time. Keeping it
 * here means a new field gets the same label scale, required marker and counter
 * alignment without another copy of the recipe.
 */
export function NewsFieldHeader({
  label,
  count,
  htmlFor,
  required = false,
  as = 'label',
  className,
}: NewsFieldHeaderProps) {
  const labelClassName =
    'text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground';
  const content = (
    <>
      {label}
      {required ? <span aria-hidden="true"> *</span> : null}
    </>
  );

  return (
    <div className={cn('mb-1 flex items-center justify-between gap-3', className)}>
      {as === 'label' ? (
        <label htmlFor={htmlFor} className={labelClassName}>
          {content}
        </label>
      ) : (
        <span className={labelClassName}>{content}</span>
      )}
      {count !== undefined && count !== null ? (
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{count}</span>
      ) : null}
    </div>
  );
}
