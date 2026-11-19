import { cleanNewsletterTopicLabel } from '@/lib/newsletters';
import {
  NEWS_POST_FIELD_WEIGHTS,
  newsletterSearchFields,
  newsletterSearchWeights,
  newsPostSearchFields,
} from './fields';
import {
  matchesNewsText,
  matchesPreparedNewsText,
  prepareNewsFields,
  scorePreparedNewsText,
} from './match';
import { normalizeNewsText, parseNewsQuery } from './normalize';

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

function matchesNewsletterTopic(
  item: NewsletterTextFields,
  options: NewsletterFilterOptions
): boolean {
  const topic = options.topic ?? ALL_NEWSLETTER_TOPICS;
  if (!topic.trim() || isAllNewsletterTopics(topic, options.allTopicsLabel)) return true;
  const topics = Array.isArray(item.topics) ? item.topics : [];
  return hasNewsletterTopic(topics, topic);
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
  const { query = '' } = options;
  return items.filter(
    (item) =>
      matchesNewsletterTopic(item, options) &&
      matchesNewsText(newsletterSearchFields(item), query)
  );
}

/** Filter published news posts by title, excerpt and slug. */
export function filterNewsPosts<T extends NewsPostTextFields>(
  posts: readonly T[],
  query: string
): T[] {
  return posts.filter((post) => matchesNewsText(newsPostSearchFields(post), query));
}

type SearchCollectionOptions<T> = {
  query: string;
  fields: (item: T) => readonly (string | null | undefined)[];
  weights: (item: T) => readonly number[];
  accepts?: (item: T) => boolean;
};

/**
 * Filter, match and rank a collection in one prepared pass.
 *
 * The previous high-level APIs filtered first and ranked the survivors, which
 * normalized every searchable field twice. Preparing each candidate once also
 * guarantees that the row that survives filtering is the same row the ranking
 * scored.
 */
function searchNewsCollection<T>(
  items: readonly T[],
  options: SearchCollectionOptions<T>
): T[] {
  const parsed = parseNewsQuery(options.query);
  const candidates = options.accepts ? items.filter(options.accepts) : [...items];
  if (parsed.tokens.length === 0) return candidates;

  return candidates
    .map((item, index) => {
      const fields = prepareNewsFields(options.fields(item));
      if (!matchesPreparedNewsText(fields, parsed)) return null;
      return {
        item,
        index,
        score: scorePreparedNewsText(fields, parsed, options.weights(item)),
      };
    })
    .filter(
      (entry): entry is { item: T; index: number; score: number } => entry !== null
    )
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}

/** Filter and rank news posts through the same public-search contract. */
export function searchNewsPosts<T extends NewsPostTextFields>(
  posts: readonly T[],
  query: string
): T[] {
  return searchNewsCollection(posts, {
    query,
    fields: newsPostSearchFields,
    weights: () => NEWS_POST_FIELD_WEIGHTS,
  });
}

/** Filter and rank bulletins, including their topic-filter semantics. */
export function searchNewsletters<T extends NewsletterTextFields>(
  items: readonly T[],
  options: NewsletterFilterOptions = {}
): T[] {
  return searchNewsCollection(items, {
    query: options.query ?? '',
    fields: newsletterSearchFields,
    weights: newsletterSearchWeights,
    accepts: (item) => matchesNewsletterTopic(item, options),
  });
}
