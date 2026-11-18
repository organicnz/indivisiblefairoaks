import { normalizeNewsletterTopics } from '@/lib/newsletters';

/**
 * Shared text processing for the public news and newsletter surfaces.
 *
 * The two archives grew independently: one lowercased and substring-matched,
 * the other reimplemented the same filter over records. That made punctuation,
 * accents and multi-word queries behave differently between two pages that
 * look the same. These helpers keep the search, topic and ordering rules in one
 * place so the public list and the admin bulletin manager cannot drift.
 *
 * They deliberately operate on plain text and structural row shapes, not on a
 * Supabase client or React state. That keeps them cheap to test and safe to use
 * while rendering.
 */

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

/** Normalize display/search text without changing the text that is rendered. */
export function normalizeNewsText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    // Apostrophes are part of a word, not a separator: "chapter's" should match
    // both "chapter's" and "chapters", not become two unrelated tokens.
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Split a query into unique normalized tokens, in the order they were typed. */
export function tokenizeNewsQuery(query: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of normalizeNewsText(query).split(' ')) {
    if (!token || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

/**
 * Match every query token against the combined searchable fields.
 *
 * This is deliberately token-based rather than a raw substring of one field:
 * "summer bulletin" should find a July title whose summary says "summer" even
 * when the words are not adjacent, and punctuation/accent differences should
 * not hide a row. An empty query matches everything.
 *
 * Tokens of four or more characters may match a longer word prefix so "school"
 * still finds "schools" and "fund" finds "funding". Shorter tokens must match a
 * whole word: otherwise "art" would match "earth" and make broad searches
 * useless.
 */
export function matchesNewsText(
  fields: readonly (string | null | undefined)[],
  query: string
): boolean {
  const tokens = tokenizeNewsQuery(query);
  if (tokens.length === 0) return true;
  const haystack = normalizeNewsText(
    fields.filter((field): field is string => typeof field === 'string' && field.length > 0).join(' ')
  );
  const words = haystack ? haystack.split(' ') : [];
  return tokens.every((token) =>
    words.some((word) => word === token || (token.length >= 4 && word.startsWith(token)))
  );
}

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
  return posts.filter((post) =>
    matchesNewsText([post.title, post.excerpt, post.slug], query)
  );
}

/** Stable archive order: explicit sort order first, then title. */
export function sortNewsletters<T extends NewsletterTextFields>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  );
}

/**
 * Replace the edited row and remove a stale slug after a rename.
 *
 * Both the public archive and the admin manager previously carried their own
 * filter-and-append logic. A rename changes the slug, so matching only the
 * saved slug left the old card behind and added a second one.
 */
export function mergeNewsletterRows<T extends NewsletterTextFields & { slug: string }>(
  items: readonly T[],
  saved: T,
  previousSlug: string | null
): T[] {
  const withoutOld = items.filter(
    (item) => item.slug !== saved.slug && (!previousSlug || item.slug !== previousSlug)
  );
  return sortNewsletters([...withoutOld, saved]);
}

/**
 * Parse a topic input that may contain a pasted comma/newline separated list.
 *
 * The editor used to treat the whole value as one topic, so pasting
 * "Election Defense, Choir Actions" created one impossible chip. Keeping the
 * parser here means the live preview and the submit path apply the same rule.
 */
export function parseNewsletterTopicInput(value: string): string[] {
  return normalizeNewsletterTopics(value.split(/[,;\n]+/));
}

/** Count words for the editor's live text statistics. */
export function countNewsletterWords(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Estimated reading time at a conventional 200 words per minute. */
export function estimateNewsletterReadingMinutes(value: string): number {
  const words = countNewsletterWords(value);
  return words === 0 ? 0 : Math.max(1, Math.ceil(words / 200));
}
