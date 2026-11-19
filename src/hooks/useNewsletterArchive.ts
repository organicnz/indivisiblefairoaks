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
export function useNewsletterArchive<T extends NewsletterTextFields>(items: readonly T[]) {
  const search = useNewsSearch();
  const [activeTopic, setActiveTopic] = useState(ALL_NEWSLETTER_TOPICS);

  const allTopics = useMemo(
    () => [ALL_NEWSLETTER_TOPICS, ...collectNewsletterTopics(items)],
    [items]
  );

  // A topic chip can disappear when its last bulletin is deleted or renamed.
  // Leaving the stale filter selected would show an empty grid with no visible
  // chip explaining why, so return to the complete archive instead.
  useEffect(() => {
    if (
      activeTopic !== ALL_NEWSLETTER_TOPICS &&
      !hasNewsletterTopic(allTopics, activeTopic)
    ) {
      setActiveTopic(ALL_NEWSLETTER_TOPICS);
    }
  }, [activeTopic, allTopics]);

  const results = useMemo(
    () =>
      searchNewsletters(items, {
        query: search.effectiveQuery,
        topic: activeTopic,
        allTopicsLabel: ALL_NEWSLETTER_TOPICS,
      }),
    [activeTopic, items, search.effectiveQuery]
  );

  const topicCounts = useMemo(
    () => countNewsletterTopics(items, search.effectiveQuery),
    [items, search.effectiveQuery]
  );

  const clearFilters = useCallback(() => {
    search.clearSearch();
    setActiveTopic(ALL_NEWSLETTER_TOPICS);
  }, [search.clearSearch]);

  // One derived truth for all result surfaces. The admin empty state and the
  // public archive previously each checked query/topic independently, which is
  // exactly how a clear button ends up saying "search" after a topic filter.
  const topicFiltered = !isAllNewsletterTopics(activeTopic);
  const filtering = search.searching || topicFiltered;

  return {
    ...search,
    activeTopic,
    setActiveTopic,
    allTopics,
    topicCounts,
    results,
    topicFiltered,
    filtering,
    clearFilters,
  };
}
