import { newsletterTopicKey, normalizeNewsletterTopics } from '@/lib/newsletters';

export { newsletterTopicKey };

/**
 * The archive's "no topic selected" sentinel.
 *
 * Presentation may translate the chip through a CMS data point, but the stored
 * filter value stays stable. Topic identity is therefore computed from labels,
 * never from object identity or a raw string comparison.
 */
export const ALL_NEWSLETTER_TOPICS = 'All Topics';

/** Whether a label is the canonical sentinel or the caller's translated label. */
export function isAllNewsletterTopics(
  topic: string,
  allTopicsLabel = ALL_NEWSLETTER_TOPICS
): boolean {
  const key = newsletterTopicKey(topic);
  return (
    Boolean(key) &&
    (key === newsletterTopicKey(ALL_NEWSLETTER_TOPICS) ||
      key === newsletterTopicKey(allTopicsLabel))
  );
}

/**
 * Return clean, first-seen topic labels without the archive sentinel.
 *
 * Legacy rows can contain duplicate spellings or either the canonical or
 * translated sentinel as a stored tag. Normalizing and filtering in one shared
 * place keeps cards, counts and filters from disagreeing.
 */
export function uniqueNewsletterTopics(
  topics: readonly string[] | null | undefined,
  allTopicsLabel = ALL_NEWSLETTER_TOPICS
): string[] {
  return normalizeNewsletterTopics(Array.isArray(topics) ? topics : []).filter(
    (topic) => !isAllNewsletterTopics(topic, allTopicsLabel)
  );
}
