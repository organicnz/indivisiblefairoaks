import { matchesPreparedNewsText, prepareNewsField, scorePreparedNewsText } from './match';
import { parseNewsQuery } from './normalize';
import { ALL_NEWSLETTER_TOPICS, newsletterTopicKey, uniqueNewsletterTopics } from './topics';

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

/** Title hits lead, summaries support them, and slugs catch URL-shaped queries. */
const NEWS_POST_FIELD_WEIGHTS = [8, 4, 2] as const;

function newsletterTopics(item: Pick<NewsletterTextFields, 'topics'>): readonly string[] {
  return item.topics ?? [];
}

function newsPostSearchFields(post: NewsPostTextFields): readonly (string | null | undefined)[] {
  return [post.title, post.excerpt, post.slug];
}

/** Topic and title hits lead; the date label is a low-weight fallback. */
function newsletterSearchFields(
  item: NewsletterTextFields
): readonly (string | null | undefined)[] {
  return [item.title, item.description, item.date_label, ...newsletterTopics(item)];
}

function newsletterSearchWeights(item: NewsletterTextFields): readonly number[] {
  return [10, 4, 2, ...newsletterTopics(item).map(() => 6)];
}

/** All unique topics in first-seen order, with case-insensitive duplicates removed. */
export function collectNewsletterTopics(
  items: readonly Pick<NewsletterTextFields, 'topics'>[],
  allTopicsLabel = ALL_NEWSLETTER_TOPICS
): string[] {
  return uniqueNewsletterTopics(
    items.flatMap((item) => newsletterTopics(item)),
    allTopicsLabel
  );
}

/** Compare topic labels by the same normalization used by search. */
export function hasNewsletterTopic(topics: readonly string[], topic: string): boolean {
  const key = newsletterTopicKey(topic);
  return Boolean(key) && topics.some((candidate) => newsletterTopicKey(candidate) === key);
}

type SearchCollectionOptions<T> = {
  query: string;
  fields: (item: T) => readonly (string | null | undefined)[];
  weights: (item: T) => readonly number[];
};

/**
 * Filter, match and rank a collection in one prepared pass.
 *
 * The query is parsed once, and each candidate's searchable fields are
 * normalized once. The same prepared fields decide both survival and score, so
 * a result can never be filtered by one interpretation and ranked by another.
 */
function searchNewsCollection<T>(items: readonly T[], options: SearchCollectionOptions<T>): T[] {
  const parsed = parseNewsQuery(options.query);
  if (parsed.tokens.length === 0) return [...items];

  return items
    .map((item, index) => {
      const fields = options.fields(item).map(prepareNewsField);
      if (!matchesPreparedNewsText(fields, parsed)) return null;
      return {
        item,
        index,
        score: scorePreparedNewsText(fields, parsed, options.weights(item)),
      };
    })
    .filter((entry): entry is { item: T; index: number; score: number } => entry !== null)
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

/**
 * Filter and rank bulletins by text only. Topic filtering is a set operation on
 * the matching rows, so callers can count topics without running the text
 * search a second time.
 */
export function searchNewsletters<T extends NewsletterTextFields>(
  items: readonly T[],
  query: string
): T[] {
  return searchNewsCollection(items, {
    query,
    fields: newsletterSearchFields,
    weights: newsletterSearchWeights,
  });
}
