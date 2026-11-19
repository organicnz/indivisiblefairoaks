import {
  containsNewsPhrase,
  matchesNewsWord,
  normalizeNewsText,
  parseNewsQuery,
  type ParsedNewsQuery,
} from './normalize';

/**
 * A searchable field with its normalized words computed once.
 *
 * Search used to normalize every field for filtering and then normalize the
 * same fields again for ranking. Preparing them once keeps the two judgments
 * identical and removes the duplicate work on every keystroke.
 */
export type PreparedNewsField = {
  words: string[];
};

export function prepareNewsField(value: string | null | undefined): PreparedNewsField | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const normalized = normalizeNewsText(value);
  if (!normalized) return null;
  return { words: normalized.split(' ') };
}

export function prepareNewsFields(
  fields: readonly (string | null | undefined)[]
): (PreparedNewsField | null)[] {
  return fields.map(prepareNewsField);
}

/**
 * Match a parsed query against prepared fields.
 *
 * Loose tokens may be spread across fields; a quoted phrase must stay inside
 * one field. Keeping that distinction here means filtering, ranking and the
 * single-pass search collection cannot disagree about what counts as a match.
 */
export function matchesPreparedNewsText(
  fields: readonly (PreparedNewsField | null)[],
  query: ParsedNewsQuery
): boolean {
  if (query.tokens.length === 0) return true;

  const words = fields.flatMap((field) => field?.words ?? []);
  return (
    query.tokens.every((token) => words.some((word) => matchesNewsWord(word, token))) &&
    query.phrases.every((phrase) =>
      fields.some((field) => field !== null && containsNewsPhrase(field.words, phrase))
    )
  );
}

export function matchesNewsText(
  fields: readonly (string | null | undefined)[],
  query: string
): boolean {
  const parsed = parseNewsQuery(query);
  if (parsed.tokens.length === 0) return true;
  return matchesPreparedNewsText(prepareNewsFields(fields), parsed);
}

/**
 * How strongly one query token matches a field.
 *
 * A complete word is stronger evidence than a longer word that merely starts
 * with the query: searching "school" should put "School Update" ahead of
 * "Schooling Update", while still keeping both. Prefixes remain available for
 * tokens of four or more characters.
 */
function tokenMatchQuality(words: readonly string[], token: string): number {
  if (words.includes(token)) return 2;
  return words.some((word) => matchesNewsWord(word, token)) ? 1 : 0;
}

/**
 * Score a matching document. Each field carries its own weight so a title hit
 * outranks a summary hit; a complete multi-token match gets a field bonus, and
 * an exact quoted phrase gets a larger one.
 */
export function scorePreparedNewsText(
  fields: readonly (PreparedNewsField | null)[],
  query: ParsedNewsQuery,
  weights?: readonly number[]
): number {
  if (query.tokens.length === 0) return 0;

  let score = 0;
  fields.forEach((field, index) => {
    if (!field || field.words.length === 0) return;

    const qualities = query.tokens.map((token) => tokenMatchQuality(field.words, token));
    const matched = qualities.filter((quality) => quality > 0).length;
    if (matched === 0) return;

    const weight = weights?.[index] ?? 1;
    score += qualities.reduce((total, quality) => total + quality, 0) * weight;
    if (matched === query.tokens.length) score += weight;

    const phraseHits = query.phrases.filter((phrase) =>
      containsNewsPhrase(field.words, phrase)
    ).length;
    score += phraseHits * weight * 2;
  });
  return score;
}

export function scoreNewsText(
  fields: readonly (string | null | undefined)[],
  query: string,
  weights?: readonly number[]
): number {
  const parsed = parseNewsQuery(query);
  if (parsed.tokens.length === 0) return 0;
  return scorePreparedNewsText(prepareNewsFields(fields), parsed, weights);
}
