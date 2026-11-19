/**
 * Shared normalization for the public news and newsletter surfaces.
 *
 * The two archives grew independently: one lowercased and substring-matched,
 * the other reimplemented the same filter over records. That made punctuation,
 * accents and multi-word queries behave differently between two pages that
 * look the same. These helpers keep the search rules in one place so the
 * public lists and the admin bulletin manager cannot drift.
 *
 * They deliberately operate on plain text, not on a Supabase client or React
 * state. That keeps them cheap to test and safe to use while rendering.
 */

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
 * A token of four or more characters may match a longer word prefix, so
 * "school" still finds "schools" and "fund" finds "funding". Shorter tokens
 * must match a whole word: otherwise "art" would match "earth" and make broad
 * searches useless.
 */
export function matchesNewsWord(word: string, token: string): boolean {
  return word === token || (token.length >= 4 && word.startsWith(token));
}

/**
 * Match every query token against the combined searchable fields.
 *
 * This is deliberately token-based rather than a raw substring of one field:
 * "summer bulletin" should find a July title whose summary says "summer" even
 * when the words are not adjacent, and punctuation/accent differences should
 * not hide a row. An empty query matches everything.
 */
export function matchesNewsText(
  fields: readonly (string | null | undefined)[],
  query: string
): boolean {
  const tokens = tokenizeNewsQuery(query);
  if (tokens.length === 0) return true;
  const haystack = normalizeNewsText(
    fields
      .filter((field): field is string => typeof field === 'string' && field.length > 0)
      .join(' ')
  );
  const words = haystack ? haystack.split(' ') : [];
  return tokens.every((token) => words.some((word) => matchesNewsWord(word, token)));
}
