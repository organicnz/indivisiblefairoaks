import type { NewsletterTextFields, NewsPostTextFields } from './search';

/** Title hits lead, summaries support them, and slugs catch URL-shaped queries. */
export const NEWS_POST_FIELD_WEIGHTS = [8, 4, 2] as const;

export function newsPostSearchFields(
  post: NewsPostTextFields
): readonly (string | null | undefined)[] {
  return [post.title, post.excerpt, post.slug];
}

/** Topic and title hits lead; the date label is a low-weight fallback. */
export function newsletterSearchFields(
  item: NewsletterTextFields
): readonly (string | null | undefined)[] {
  const topics = Array.isArray(item.topics) ? item.topics : [];
  return [item.title, item.description, item.date_label, ...topics];
}

export function newsletterSearchWeights(item: NewsletterTextFields): readonly number[] {
  const topics = Array.isArray(item.topics) ? item.topics : [];
  return [10, 4, 2, ...topics.map(() => 6)];
}
