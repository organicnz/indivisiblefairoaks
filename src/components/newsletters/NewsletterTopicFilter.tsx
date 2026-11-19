'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import {
  ALL_NEWSLETTER_TOPICS,
  hasNewsletterTopic,
  isAllNewsletterTopics,
  type NewsletterTopicCounts,
  newsletterTopicKey,
} from '@/lib/news-text';
import { cn } from '@/lib/utils';

type NewsletterTopicFilterProps = {
  topics: string[];
  activeTopic: string;
  onTopicChange: (topic: string) => void;
  allTopicsLabel?: string;
  resultsId?: string;
  variant?: 'public' | 'admin';
  maxVisible?: number;
  counts?: NewsletterTopicCounts;
};

/**
 * Topic chips shared by the public archive and the admin bulletin manager.
 *
 * The active topic is appended when it falls past the visible window. Without
 * that, changing or removing rows could make the selected filter disappear
 * while still narrowing the results. A "more" control keeps every other topic
 * reachable instead of silently truncating the archive's vocabulary.
 */
export function NewsletterTopicFilter({
  topics,
  activeTopic,
  onTopicChange,
  allTopicsLabel = ALL_NEWSLETTER_TOPICS,
  resultsId,
  variant = 'public',
  maxVisible = 6,
  counts,
}: NewsletterTopicFilterProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleLimit = Math.max(1, maxVisible);
  const activeIsAll = isAllNewsletterTopics(activeTopic, allTopicsLabel);
  const visibleTopics = expanded ? [...topics] : topics.slice(0, visibleLimit);

  if (activeTopic.trim() && !activeIsAll && !hasNewsletterTopic(visibleTopics, activeTopic)) {
    visibleTopics.push(activeTopic);
  }

  // Count only topics the reader cannot currently see. The selected topic is
  // appended to the collapsed row, so it should not inflate the "more" count.
  const hiddenCount = topics.filter((topic) => !hasNewsletterTopic(visibleTopics, topic)).length;
  const canCollapse = expanded && topics.length > visibleLimit;
  const showToggle = hiddenCount > 0 || canCollapse;

  const chipSize =
    variant === 'admin'
      ? 'min-h-8 px-2.5 py-1 text-[10px]'
      : 'min-h-10 px-3 py-1.5 text-[11px] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

  return (
    <div
      role="group"
      aria-label="Filter bulletins by topic"
      className={cn('flex flex-wrap items-center gap-1.5', variant === 'admin' && 'gap-1')}
    >
      {visibleTopics.map((topic) => {
        const selected = isAllNewsletterTopics(topic, allTopicsLabel)
          ? activeIsAll
          : hasNewsletterTopic([topic], activeTopic);
        const count = counts
          ? isAllNewsletterTopics(topic, allTopicsLabel)
            ? counts.all
            : (counts.byTopic[newsletterTopicKey(topic)] ?? 0)
          : null;
        const label = topic === ALL_NEWSLETTER_TOPICS ? allTopicsLabel : topic;
        // The visible label and count are part of the button's text content.
        // Keep them at the start of the accessible name with the same spacing:
        // a comma or missing space makes the name fail WCAG 2.5.3
        // (label-content-name-mismatch).
        const accessibleLabel =
          count === null ? null : `${label} ${count} ${count === 1 ? 'bulletin' : 'bulletins'}`;

        return (
          <button
            key={topic}
            type="button"
            aria-pressed={selected}
            aria-controls={resultsId}
            aria-label={accessibleLabel ?? undefined}
            title={accessibleLabel ?? label}
            onClick={() => onTopicChange(topic)}
            className={cn(
              'inline-flex max-w-full min-w-0 items-center border font-bold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              chipSize,
              selected
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-surface-muted/60 text-muted-foreground hover:bg-surface-card hover:text-foreground dark:text-ink-muted-on-dark dark:hover:bg-white/5 dark:hover:text-ink-on-dark'
            )}
          >
            <span className="min-w-0 truncate">{label}</span>{' '}
            {count !== null ? (
              <span className="ml-1 shrink-0 font-mono text-[9px]">{count}</span>
            ) : null}
          </button>
        );
      })}

      {showToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          title={expanded ? 'Show fewer topics' : `Show ${hiddenCount} more topics`}
          className={cn(
            'inline-flex items-center gap-1 border border-dashed border-border bg-transparent font-bold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            chipSize
          )}
        >
          {expanded ? (
            <ChevronUp size={11} aria-hidden="true" />
          ) : (
            <ChevronDown size={11} aria-hidden="true" />
          )}
          <span>{expanded ? 'Fewer topics' : `More topics (${hiddenCount})`}</span>
        </button>
      ) : null}
    </div>
  );
}
