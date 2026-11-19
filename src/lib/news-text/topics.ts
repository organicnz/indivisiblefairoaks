import { collapseNewsWhitespace, normalizeNewsText } from './normalize';

/** Topic identity must match the read-side search fold. */
export function newsletterTopicKey(value: string): string {
  return normalizeNewsText(value);
}

/**
 * Trim, drop empties and collapse case-insensitive duplicates.
 *
 * The previous action stored whatever the caller sent, so a repeated tag
 * rendered twice and an empty chip rendered as a blank box. The public archive
 * treats topics as a set; the write path should make that true.
 */
export function normalizeNewsletterTopics(topics: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const topic of topics) {
    const value = collapseNewsWhitespace(topic);
    if (!value) continue;
    const key = newsletterTopicKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }
  return normalized;
}

/**
 * The archive's "no topic selected" sentinel.
 *
 * Presentation may translate the chip through a CMS data point, but the stored
 * filter value stays stable. Topic identity is therefore computed from labels,
 * never from object identity or a raw string comparison.
 */
export const ALL_NEWSLETTER_TOPICS = 'All Topics';
const ALL_TOPICS_KEY = newsletterTopicKey(ALL_NEWSLETTER_TOPICS);

/** Whether a label is the canonical sentinel or the caller's translated label. */
export function isAllNewsletterTopics(
  topic: string,
  allTopicsLabel = ALL_NEWSLETTER_TOPICS
): boolean {
  const key = newsletterTopicKey(topic);
  return Boolean(key) && (key === ALL_TOPICS_KEY || key === newsletterTopicKey(allTopicsLabel));
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
  return normalizeNewsletterTopics(topics ?? []).filter(
    (topic) => !isAllNewsletterTopics(topic, allTopicsLabel)
  );
}
