import {
  containsNewsPhrase,
  matchesNewsWord,
  normalizeNewsText,
  parseNewsQuery,
} from './normalize';
import type { NewsletterTextFields, NewsPostTextFields } from './search';

/**
 * Score how strongly a row matches the query. Each field carries its own weight
 * so a title hit outranks a summary hit, and a complete match gets a bonus.
 * Quoted phrases add another bonus when the exact sequence appears in a field.
 */
export function scoreNewsText(
  fields: readonly (string | null | undefined)[],
  query: string,
  weights?: readonly number[]
): number {
  const { tokens, phrases } = parseNewsQuery(query);
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
    score += phrases.filter((phrase) => containsNewsPhrase(words, phrase)).length * weight;
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
  if (parseNewsQuery(query).tokens.length === 0) return [...posts];
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
  if (parseNewsQuery(query).tokens.length === 0) return [...items];
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
