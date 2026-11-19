import { Tag } from 'lucide-react';
import { HighlightedText } from '@/components/ui/HighlightedText';
import { cn } from '@/lib/utils';

type NewsletterTopicPillsProps = {
  topics?: readonly string[] | null;
  query?: string;
  variant?: 'card' | 'admin' | 'preview';
  className?: string;
};

const WRAPPER_STYLES: Record<NonNullable<NewsletterTopicPillsProps['variant']>, string> = {
  card: 'flex flex-wrap gap-1.5 pt-2',
  admin: 'mt-2 flex flex-wrap gap-1',
  preview: 'mt-3 flex flex-wrap gap-1.5',
};

const CHIP_STYLES: Record<NonNullable<NewsletterTopicPillsProps['variant']>, string> = {
  card: 'border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground dark:text-ink-on-dark',
  admin:
    'inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground',
  preview:
    'border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground',
};

/**
 * The archive's topic chips are editorial metadata, not filter controls. They
 * appear on the public bulletin card, the admin manager row and the editor
 * preview, and previously carried three copies of the same list/highlight
 * markup. Keeping presentation variants here makes a future surface inherit
 * the same empty handling, duplicate-key policy and query highlighting.
 */
export function NewsletterTopicPills({
  topics,
  query,
  variant = 'card',
  className,
}: NewsletterTopicPillsProps) {
  const list = Array.isArray(topics) ? topics : [];
  if (list.length === 0) return null;

  return (
    <div className={cn(WRAPPER_STYLES[variant], className)}>
      {list.map((topic, index) => (
        <span key={`${topic}-${index}`} className={CHIP_STYLES[variant]}>
          {variant === 'admin' ? <Tag size={9} aria-hidden="true" /> : null}
          <span>
            <HighlightedText text={topic} query={query} />
          </span>
        </span>
      ))}
    </div>
  );
}
