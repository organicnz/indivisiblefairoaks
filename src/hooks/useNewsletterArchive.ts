'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ALL_NEWSLETTER_TOPICS,
  collectNewsletterTopics,
  countNewsletterTopics,
  hasNewsletterTopic,
  isAllNewsletterTopics,
  type NewsletterTextFields,
  searchNewsletters,
} from '@/lib/news-text';
import { useNewsSearch } from './useNewsSearch';

/**
 * The archive's view state, independent of where the rows came from. Both the
 * public bulletin list and the admin manager use this so a query cannot mean
 * one thing on `/newsletters` and another inside `/admin/news`.
 */
export function useNewsletterArchive<T extends NewsletterTextFields>(
  items: readonly T[],
  { allTopicsLabel = ALL_NEWSLETTER_TOPICS }: { allTopicsLabel?: string } = {}
) {
  const search = useNewsSearch();
  const [activeTopic, setActiveTopic] = useState(ALL_NEWSLETTER_TOPICS);
  const activeIsAll = useMemo(
    () => isAllNewsletterTopics(activeTopic, allTopicsLabel),
    [activeTopic, allTopicsLabel]
  );

  const allTopics = useMemo(
    () => [ALL_NEWSLETTER_TOPICS, ...collectNewsletterTopics(items, allTopicsLabel)],
    [allTopicsLabel, items]
  );

  // A topic chip can disappear when its last bulletin is deleted or renamed.
  // Leaving the stale filter selected would show an empty grid with no visible
  // chip explaining why, so return to the complete archive instead. A translated
  // "All Topics" label is also a sentinel, not a stale topic.
  useEffect(() => {
    if (!activeIsAll && !hasNewsletterTopic(allTopics, activeTopic)) {
      setActiveTopic(ALL_NEWSLETTER_TOPICS);
    }
  }, [activeIsAll, activeTopic, allTopics]);

  // Query matching happens once. Topic filtering and chip counts then reuse the
  // same result set instead of normalizing every searchable field a second time.
  const queryMatches = useMemo(
    () => searchNewsletters(items, search.effectiveQuery),
    [items, search.effectiveQuery]
  );

  const results = useMemo(() => {
    if (activeIsAll) return queryMatches;
    return queryMatches.filter((item) =>
      hasNewsletterTopic(Array.isArray(item.topics) ? item.topics : [], activeTopic)
    );
  }, [activeIsAll, activeTopic, queryMatches]);

  const topicCounts = useMemo(
    () => countNewsletterTopics(queryMatches, allTopicsLabel),
    [allTopicsLabel, queryMatches]
  );

  const clearFilters = useCallback(() => {
    search.clearSearch();
    setActiveTopic(ALL_NEWSLETTER_TOPICS);
  }, [search.clearSearch]);

  // One derived truth for all result surfaces. The admin empty state and the
  // public archive previously each checked query/topic independently, which is
  // exactly how a clear button ends up saying "search" after a topic filter.
  const topicFiltered = !activeIsAll;
  const filtering = search.searching || topicFiltered;

  return {
    ...search,
    activeTopic,
    setActiveTopic,
    allTopicsLabel,
    allTopics,
    topicCounts,
    results,
    topicFiltered,
    filtering,
    clearFilters,
  };
}
