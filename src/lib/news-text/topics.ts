import { cleanNewsletterTopicLabel } from '@/lib/newsletters';
import { normalizeNewsText } from './normalize';

/**
 * The archive's "no topic selected" sentinel.
 *
 * Presentation may translate the chip through a CMS data point, but the stored
 * filter value stays stable. Topic identity is therefore computed from labels,
 * never from object identity or a raw string comparison.
 */
export const ALL_NEWSLETTER_TOPICS = 'All Topics';

/** Fold a topic label the same way search folds text, so chips cannot drift. */
export function newsletterTopicKey(value: string): string {
  return normalizeNewsText(cleanNewsletterTopicLabel(value));
}

/** Whether a label is the sentinel, including a translated sentinel. */
export function isAllNewsletterTopics(
  topic: string,
  allTopicsLabel = ALL_NEWSLETTER_TOPICS
): boolean {
  const key = newsletterTopicKey(topic);
  return Boolean(key) && key === newsletterTopicKey(allTopicsLabel);
}

/**
 * Return clean, first-seen topic labels without the archive sentinel.
 *
 * Legacy rows can contain duplicate spellings or `All Topics` as a stored tag.
 * Every public/admin surface now uses this one dedupe rule, so a card cannot
 * show two chips for the same topic that the filter considers one.
 */
export function uniqueNewsletterTopics(
  topics: readonly string[] | null | undefined,
  allTopicsLabel = ALL_NEWSLETTER_TOPICS
): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const rawTopic of Array.isArray(topics) ? topics : []) {
    if (typeof rawTopic !== 'string') continue;
    const topic = cleanNewsletterTopicLabel(rawTopic);
    const key = newsletterTopicKey(topic);
    if (
      !key ||
      seen.has(key) ||
      isAllNewsletterTopics(topic) ||
      isAllNewsletterTopics(topic, allTopicsLabel)
    ) {
      continue;
    }
    seen.add(key);
    unique.push(topic);
  }

  return unique;
}
