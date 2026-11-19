import {
  NEWS_POST_FIELD_WEIGHTS,
  newsletterSearchFields,
  newsletterSearchWeights,
  newsPostSearchFields,
} from './fields';
import { prepareNewsFields, scorePreparedNewsText } from './match';
import { parseNewsQuery } from './normalize';
import type { NewsletterTextFields, NewsPostTextFields } from './search';

/**
 * Rank matching posts so title hits and complete multi-word matches lead.
 * Ties retain the caller's original order.
 */
export function rankNewsPosts<T extends NewsPostTextFields>(
  posts: readonly T[],
  query: string
): T[] {
  const parsed = parseNewsQuery(query);
  if (parsed.tokens.length === 0) return [...posts];
  return posts
    .map((post, index) => ({
      post,
      index,
      score: scorePreparedNewsText(
        prepareNewsFields(newsPostSearchFields(post)),
        parsed,
        NEWS_POST_FIELD_WEIGHTS
      ),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ post }) => post);
}

/** Rank matching bulletins by title, topic, summary and date label. */
export function rankNewsletters<T extends NewsletterTextFields>(
  items: readonly T[],
  query: string
): T[] {
  const parsed = parseNewsQuery(query);
  if (parsed.tokens.length === 0) return [...items];
  return items
    .map((item, index) => ({
      item,
      index,
      score: scorePreparedNewsText(
        prepareNewsFields(newsletterSearchFields(item)),
        parsed,
        newsletterSearchWeights(item)
      ),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}
