'use client';

import { Plus } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';
import { NEWS_SEARCH_HINT, NewsSearchField } from '@/components/ui/NewsSearchField';
import { NewsletterTopicFilter } from '@/components/newsletters/NewsletterTopicFilter';
import { ALL_NEWSLETTER_TOPICS, type NewsletterTopicCounts } from '@/lib/news-text';

type NewsletterFilterBarProps = {
  dataPoints: Record<string, string>;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  topics: string[];
  topicCounts?: NewsletterTopicCounts;
  activeTopic: string;
  onTopicChange: (topic: string) => void;
  /** Optional authoring action; its presence, not a role flag, reveals it. */
  onAdd?: () => void;
  /** The id of the archive grid this bar filters. */
  resultsId?: string;
};

/** Search, topic chips and the admin add action for the public bulletin archive. */
export function NewsletterFilterBar({
  dataPoints,
  searchQuery,
  onSearchChange,
  topics,
  topicCounts,
  activeTopic,
  onTopicChange,
  onAdd,
  resultsId,
}: NewsletterFilterBarProps) {
  return (
    <div className="civic-panel flex flex-col items-stretch justify-between gap-4 p-4 md:flex-row md:items-center">
      <NewsSearchField
        variant="newsletter"
        className="flex-1"
        value={searchQuery}
        onChange={onSearchChange}
        placeholder={
          dataPoints['news.search.placeholder'] || 'Search bulletins, topics, or insights...'
        }
        ariaLabel="Search bulletins by title, topic, or summary"
        testId="newsletter-search"
        iconSize={16}
        clearLabel="Clear bulletin search"
        resultsId={resultsId}
        hint={NEWS_SEARCH_HINT}
      />

      <NewsletterTopicFilter
        topics={topics}
        activeTopic={activeTopic}
        onTopicChange={onTopicChange}
        allTopicsLabel={dataPoints['news.topic.all'] || ALL_NEWSLETTER_TOPICS}
        resultsId={resultsId}
        counts={topicCounts}
      />

      {onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 border border-primary bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
