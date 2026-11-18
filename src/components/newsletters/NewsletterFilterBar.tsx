'use client';

import { Plus, Search, X } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';
import { ALL_NEWSLETTER_TOPICS } from '@/lib/news-text';

type NewsletterFilterBarProps = {
  dataPoints: Record<string, string>;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  topics: string[];
  activeTopic: string;
  onTopicChange: (topic: string) => void;
  isAdmin: boolean;
  onAdd: () => void;
};

/**
 * Search, topic chips and the admin add action for the public bulletin archive.
 *
 * The active topic is appended when it falls past the six-chip window. Without
 * that, changing or removing rows could make the selected filter disappear
 * while still narrowing the results.
 */
export function NewsletterFilterBar({
  dataPoints,
  searchQuery,
  onSearchChange,
  topics,
  activeTopic,
  onTopicChange,
  isAdmin,
  onAdd,
}: NewsletterFilterBarProps) {
  const visibleTopics = topics.slice(0, 6);
  if (activeTopic !== ALL_NEWSLETTER_TOPICS && !visibleTopics.includes(activeTopic)) {
    visibleTopics.push(activeTopic);
  }

  return (
    <div className="civic-panel flex flex-col items-stretch justify-between gap-4 p-4 md:flex-row md:items-center">
      <div className="relative flex-1">
        <Search
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-ink-muted-on-dark"
          size={16}
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label="Search bulletins by title, topic, or summary"
          data-testid="newsletter-search"
          placeholder={
            dataPoints['news.search.placeholder'] || 'Search bulletins, topics, or insights...'
          }
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full border border-border bg-surface-muted py-2.5 pl-10 pr-10 text-xs text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:text-sm dark:border-white/10 dark:text-white"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear bulletin search"
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-surface-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={13} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {visibleTopics.map((topic) => (
          <button
            key={topic}
            type="button"
            aria-pressed={activeTopic === topic}
            onClick={() => onTopicChange(topic)}
            className={`min-h-10 border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${
              activeTopic === topic
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-surface-muted/60 text-muted-foreground hover:bg-surface-card hover:text-foreground dark:text-ink-muted-on-dark dark:hover:bg-white/5 dark:hover:text-ink-on-dark'
            }`}
          >
            {topic === ALL_NEWSLETTER_TOPICS
              ? dataPoints['news.topic.all'] || ALL_NEWSLETTER_TOPICS
              : topic}
          </button>
        ))}
      </div>

      {isAdmin ? (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 border border-primary bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark"
        >
          <Plus size={15} aria-hidden="true" />
          <DataPoint name="news.admin.add_bulletin" as="span" initialData={dataPoints}>
            Add Bulletin
          </DataPoint>
        </button>
      ) : null}
    </div>
  );
}
