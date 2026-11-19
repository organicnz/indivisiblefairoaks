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
import { useUrlParamState } from './useUrlParamState';

/**
 * The archive's view state, independent of where the rows came from. Both the
 * public bulletin list and the admin manager use this so a query cannot mean
 * one thing on `/newsletters` and another inside `/admin/news`.
 */
export function useNewsletterArchive<T extends NewsletterTextFields>(
  items: readonly T[],
  {
    allTopicsLabel = ALL_NEWSLETTER_TOPICS,
    syncUrl = false,
  }: { allTopicsLabel?: string; syncUrl?: boolean } = {}
) {
  const search = useNewsSearch('', { urlParam: syncUrl ? 'q' : undefined });
  const [urlTopic, setUrlTopic] = useUrlParamState('topic', { enabled: syncUrl });
  const [activeTopic, setActiveTopicState] = useState(ALL_NEWSLETTER_TOPICS);
  const activeIsAll = useMemo(
    () => isAllNewsletterTopics(activeTopic, allTopicsLabel),
    [activeTopic, allTopicsLabel]
  );

  const allTopics = useMemo(
    () => [ALL_NEWSLETTER_TOPICS, ...collectNewsletterTopics(items, allTopicsLabel)],
    [allTopicsLabel, items]
  );

  const setActiveTopic = useCallback(
    (topic: string) => {
      setActiveTopicState(topic);
      if (syncUrl) {
        setUrlTopic(isAllNewsletterTopics(topic, allTopicsLabel) ? '' : topic);
      }
    },
    [allTopicsLabel, setUrlTopic, syncUrl]
  );

  // Apply a shared or history-restored topic once the archive's vocabulary is
  // known. An unknown topic is dropped rather than left as an invisible filter.
  useEffect(() => {
    if (!syncUrl) return;
    const requested = urlTopic.trim();
    if (!requested || isAllNewsletterTopics(requested, allTopicsLabel)) {
      setActiveTopicState(ALL_NEWSLETTER_TOPICS);
      if (requested) setUrlTopic('');
      return;
    }

    const match = allTopics.find((topic) => hasNewsletterTopic([topic], requested));
    if (match) {
      setActiveTopicState(match);
      return;
    }

    setActiveTopicState(ALL_NEWSLETTER_TOPICS);
    setUrlTopic('');
  }, [allTopics, allTopicsLabel, setUrlTopic, syncUrl, urlTopic]);

  // A topic chip can disappear when its last bulletin is deleted or renamed.
  // Leaving the stale filter selected would show an empty grid with no visible
  // chip explaining why, so return to the complete archive instead. A translated
  // "All Topics" label is also a sentinel, not a stale topic.
  useEffect(() => {
    if (!activeIsAll && !hasNewsletterTopic(allTopics, activeTopic)) {
      setActiveTopic(ALL_NEWSLETTER_TOPICS);
    }
  }, [activeIsAll, activeTopic, allTopics, setActiveTopic]);

  // Query matching happens once. Topic filtering and chip counts then reuse the
  // same result set instead of normalizing every searchable field a second time.
  const queryMatches = useMemo(
    () => searchNewsletters(items, search.effectiveQuery),
    [items, search.effectiveQuery]
  );

  const results = useMemo(() => {
    if (activeIsAll) return queryMatches;
    return queryMatches.filter((item) => hasNewsletterTopic(item.topics ?? [], activeTopic));
  }, [activeIsAll, activeTopic, queryMatches]);

  const topicCounts = useMemo(
    () => countNewsletterTopics(queryMatches, allTopicsLabel),
    [allTopicsLabel, queryMatches]
  );

  const clearFilters = useCallback(() => {
    search.clearSearch();
    setActiveTopic(ALL_NEWSLETTER_TOPICS);
  }, [search.clearSearch, setActiveTopic]);

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
