import type { NewsletterTextFields } from './search';
import {
  ALL_NEWSLETTER_TOPICS,
  newsletterTopicKey,
  normalizeNewsletterTopics,
  uniqueNewsletterTopics,
} from './topics';

const TOPIC_LIST_MARKER = /^(?:[-*•]+|\d+[.)])\s*/;
const TOPIC_SEPARATOR = /[,;|\t\r\n]+|\s*[•·]\s*/;

/** Remove the decoration people leave on a pasted tag list, not the words. */
function cleanPastedTopic(value: string): string {
  return value
    .replace(TOPIC_LIST_MARKER, '')
    .replace(/^#+\s*/, '')
    .trim();
}

/**
 * Parse a topic input that may contain a pasted comma, semicolon, pipe, tab or
 * newline separated list. Bullets, numbered-list markers and leading hashtags
 * are treated as paste decoration rather than part of the topic label.
 *
 * Normalization belongs here as well as at the write boundary: the editor's
 * live preview and the submit path should not disagree about whether
 * "Election  Defense" and "election defense" are the same chip.
 */
export function parseNewsletterTopicInput(value: string): string[] {
  return normalizeNewsletterTopics(value.split(TOPIC_SEPARATOR).map(cleanPastedTopic));
}

export type NewsletterTopicCounts = {
  /** Bulletins matching the current query before a topic chip is applied. */
  all: number;
  /** Counts keyed by normalized topic label. */
  byTopic: Record<string, number>;
};

/**
 * Count topics in the rows that already survived the current query.
 *
 * A chip count is useful only when it describes the rows the reader can still
 * reach: showing the unfiltered total beside a filtered list would promise
 * results that the active query has already removed. The caller passes the
 * query matches so this function never repeats the text search.
 */
export function countNewsletterTopics<T extends NewsletterTextFields>(
  items: readonly T[],
  allTopicsLabel = ALL_NEWSLETTER_TOPICS
): NewsletterTopicCounts {
  const byTopic: Record<string, number> = {};

  for (const item of items) {
    for (const topic of uniqueNewsletterTopics(item.topics, allTopicsLabel)) {
      const key = newsletterTopicKey(topic);
      byTopic[key] = (byTopic[key] ?? 0) + 1;
    }
  }

  return { all: items.length, byTopic };
}
