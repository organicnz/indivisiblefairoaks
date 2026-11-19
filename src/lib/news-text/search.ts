import { cleanNewsletterTopicLabel } from '@/lib/newsletters';
import { matchesNewsText, normalizeNewsText, resolveNewsQuery } from './normalize';
import { rankNewsletters, rankNewsPosts } from './ranking';

export const ALL_NEWSLETTER_TOPICS = 'All Topics';

/**
 * The sentinel is a label, not a value to compare with `===`: the CMS can
 * translate the chip while the active filter stays on the sentinel.
 */
export function isAllNewsletterTopics(
  topic: string,
  allTopicsLabel = ALL_NEWSLETTER_TOPICS
): boolean {
  return normalizeNewsText(topic) === normalizeNewsText(allTopicsLabel);
}

export type NewsletterTextFields = {
  title: string;
  description?: string | null;
  date_label?: string | null;
  topics?: readonly string[] | null;
  sort_order?: number | null;
};

export type NewsletterFilterOptions = {
  query?: string;
  topic?: string;
  allTopicsLabel?: string;
};

export type NewsPostTextFields = {
  title: string;
  excerpt?: string | null;
  slug?: string | null;
};

/** All unique topics in first-seen order, with case-insensitive duplicates removed. */
export function collectNewsletterTopics(
  items: readonly Pick<NewsletterTextFields, 'topics'>[]
): string[] {
  const topics: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!Array.isArray(item.topics)) continue;
    for (const rawTopic of item.topics) {
      const topic = cleanNewsletterTopicLabel(rawTopic);
      if (!topic) continue;
      const key = normalizeNewsText(topic);
      // "All Topics" is the archive's sentinel, not a real tag. A stored copy
      // would otherwise render a second, duplicate filter chip.
      if (!key || key === normalizeNewsText(ALL_NEWSLETTER_TOPICS) || seen.has(key)) continue;
      seen.add(key);
      topics.push(topic);
    }
  }
  return topics;
}

/** Compare topic labels by the same normalization used by search. */
export function hasNewsletterTopic(topics: readonly string[], topic: string): boolean {
  const key = normalizeNewsText(topic);
  return Boolean(key) && topics.some((candidate) => normalizeNewsText(candidate) === key);
}

/**
 * Filter the archive by topic and free text.
 *
 * `allTopicsLabel` is supplied by the caller because the public page can
 * translate the "All Topics" chip through a CMS data point. Matching the
 * sentinel by value lets a translated chip keep working without making the
 * filter understand presentation.
 */
export function filterNewsletters<T extends NewsletterTextFields>(
  items: readonly T[],
  options: NewsletterFilterOptions = {}
): T[] {
  const { query = '', topic = ALL_NEWSLETTER_TOPICS, allTopicsLabel = ALL_NEWSLETTER_TOPICS } =
    options;
  const topicKey = normalizeNewsText(topic);
  const isAllTopics = isAllNewsletterTopics(topic, allTopicsLabel);

  return items.filter((item) => {
    const topics = Array.isArray(item.topics) ? item.topics : [];
    const matchesTopic =
      !topicKey ||
      isAllTopics ||
      hasNewsletterTopic(topics, topic);

    return (
      matchesTopic &&
      matchesNewsText([item.title, item.description, item.date_label, ...topics], query)
    );
  });
}

/** Filter published news posts by title, excerpt and slug. */
export function filterNewsPosts<T extends NewsPostTextFields>(
  posts: readonly T[],
  query: string
): T[] {
  return posts.filter((post) => matchesNewsText([post.title, post.excerpt, post.slug], query));
}

/** Filter and rank news posts through the same public-search contract. */
export function searchNewsPosts<T extends NewsPostTextFields>(
  posts: readonly T[],
  query: string
): T[] {
  const normalized = resolveNewsQuery(query);
  return rankNewsPosts(filterNewsPosts(posts, normalized), normalized);
}

/** Filter and rank bulletins, including their topic-filter semantics. */
export function searchNewsletters<T extends NewsletterTextFields>(
  items: readonly T[],
  options: NewsletterFilterOptions = {}
): T[] {
  const normalized = resolveNewsQuery(options.query ?? '');
  return rankNewsletters(
    filterNewsletters(items, { ...options, query: normalized }),
    normalized
  );
}
