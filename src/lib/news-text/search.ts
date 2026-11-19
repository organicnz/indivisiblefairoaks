import { matchesNewsText, matchesNewsWord, normalizeNewsText, tokenizeNewsQuery } from './normalize';

export const ALL_NEWSLETTER_TOPICS = 'All Topics';

export type NewsletterTextFields = {
  title: string;
  description?: string | null;
  date_label?: string | null;
  topics?: readonly string[] | null;
  sort_order?: number | null;
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
      const topic = rawTopic.trim();
      if (!topic) continue;
      const key = normalizeNewsText(topic);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      topics.push(topic);
    }
  }
  return topics;
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
  options: {
    query?: string;
    topic?: string;
    allTopicsLabel?: string;
  } = {}
): T[] {
  const { query = '', topic = ALL_NEWSLETTER_TOPICS, allTopicsLabel = ALL_NEWSLETTER_TOPICS } =
    options;
  const topicKey = normalizeNewsText(topic);
  const allTopicsKey = normalizeNewsText(allTopicsLabel);

  return items.filter((item) => {
    const topics = Array.isArray(item.topics) ? item.topics : [];
    const matchesTopic =
      !topicKey ||
      topicKey === allTopicsKey ||
      topics.some((candidate) => normalizeNewsText(candidate) === topicKey);

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

/**
 * Score how strongly a row matches the query. Each field carries its own weight
 * so a title hit outranks a summary hit, and a complete match gets a bonus.
 * Exposed for the ranking helpers and for callers that need a custom field set.
 */
export function scoreNewsText(
  fields: readonly (string | null | undefined)[],
  query: string,
  weights?: readonly number[]
): number {
  const tokens = tokenizeNewsQuery(query);
  if (tokens.length === 0) return 0;

  let score = 0;
  fields.forEach((field, index) => {
    if (typeof field !== 'string' || field.length === 0) return;
    const words = normalizeNewsText(field).split(' ').filter(Boolean);
    if (words.length === 0) return;

    const matched = tokens.filter((token) =>
      words.some((word) => matchesNewsWord(word, token))
    ).length;
    if (matched === 0) return;

    const weight = weights?.[index] ?? 1;
    score += matched * weight;
    if (matched === tokens.length) score += weight;
  });
  return score;
}

/**
 * Rank matching posts so title hits and complete multi-word matches lead.
 * Ties retain the caller's original order.
 */
export function rankNewsPosts<T extends NewsPostTextFields>(
  posts: readonly T[],
  query: string
): T[] {
  if (tokenizeNewsQuery(query).length === 0) return [...posts];
  return posts
    .map((post, index) => ({
      post,
      index,
      score: scoreNewsText([post.title, post.excerpt, post.slug], query, [8, 4, 2]),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ post }) => post);
}

/** Rank matching bulletins by title, topic, summary and date label. */
export function rankNewsletters<T extends NewsletterTextFields>(
  items: readonly T[],
  query: string
): T[] {
  if (tokenizeNewsQuery(query).length === 0) return [...items];
  return items
    .map((item, index) => {
      const topics = Array.isArray(item.topics) ? item.topics : [];
      return {
        item,
        index,
        score: scoreNewsText(
          [item.title, item.description, item.date_label, ...topics],
          query,
          [10, 4, 2, ...topics.map(() => 6)]
        ),
      };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}
