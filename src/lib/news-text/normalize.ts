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

const INVISIBLE_CHARACTERS = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;
const UNICODE_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

/**
 * Fold letters that do not decompose under NFKD. Without this, "Søren" and
 * "Soren" are different words even though a reader sees the same name.
 */
const LETTER_FOLDS: Record<string, string> = {
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  ı: 'i',
  ħ: 'h',
  ŋ: 'ng',
  ŧ: 't',
};

const FOLDABLE_LETTERS = /[ßæœøłđðþıħŋŧ]/g;

/** Normalize display/search text without changing the text that is rendered. */
export function normalizeNewsText(value: string): string {
  return value
    .normalize('NFKD')
    // Strip combining marks from Latin diacritics ("Café" -> "Cafe") while
    // preserving marks that are part of another script's spelling.
    .replace(/[\u0300-\u036F]/g, '')
    .replace(INVISIBLE_CHARACTERS, '')
    .replace(UNICODE_SPACES, ' ')
    // Apostrophes are part of a word, not a separator: "chapter's" should match
    // both "chapter's" and "chapters", not become two unrelated tokens.
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(FOLDABLE_LETTERS, (letter) => LETTER_FOLDS[letter] ?? letter)
    // Keep letters, numbers and combining marks from every script. Limiting
    // this to a-z silently erased searches for names written in other scripts.
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim();
}

export type ParsedNewsQuery = {
  /** Every normalized term, including terms inside quoted phrases. */
  tokens: string[];
  /** Quoted word sequences that must appear contiguously. */
  phrases: string[][];
};

const QUERY_QUOTE_CHARACTERS = new Set(['"', '“', '”']);

type NewsQuerySegment = {
  text: string;
  quoted: boolean;
};

function splitNewsQuerySegments(query: string): NewsQuerySegment[] {
  const segments: NewsQuerySegment[] = [];
  let current = '';
  let quoted = false;

  const push = () => {
    if (!current.trim()) return;
    segments.push({ text: current, quoted });
  };

  for (const character of query) {
    if (QUERY_QUOTE_CHARACTERS.has(character)) {
      push();
      current = '';
      quoted = !quoted;
      continue;
    }
    current += character;
  }
  push();
  return segments;
}

/**
 * Parse a query once into loose terms and quoted phrases.
 *
 * Unquoted terms keep the forgiving prefix behavior. Quoted text must appear as
 * a contiguous sequence of normalized words, so a search for "public schools"
 * cannot be satisfied by a title containing "public" and a summary containing
 * "schools" in two unrelated places.
 */
export function parseNewsQuery(query: string): ParsedNewsQuery {
  const tokens: string[] = [];
  const phrases: string[][] = [];
  const seenTokens = new Set<string>();
  const seenPhrases = new Set<string>();

  const addToken = (token: string) => {
    if (seenTokens.has(token)) return;
    seenTokens.add(token);
    tokens.push(token);
  };

  for (const segment of splitNewsQuerySegments(query)) {
    const words = normalizeNewsText(segment.text).split(' ').filter(Boolean);
    for (const word of words) addToken(word);
    if (!segment.quoted || words.length === 0) continue;

    const key = words.join(' ');
    if (seenPhrases.has(key)) continue;
    seenPhrases.add(key);
    phrases.push(words);
  }

  return { tokens, phrases };
}

/** Split a query into unique normalized tokens, in the order they were typed. */
export function tokenizeNewsQuery(query: string): string[] {
  return parseNewsQuery(query).tokens;
}

/**
 * Whether the input is more than whitespace, punctuation or invisible paste
 * debris. UI surfaces use this instead of testing `query` for truthiness, which
 * treated "   " as an active search and cropped every summary.
 */
export function hasNewsQuery(query: string): boolean {
  return tokenizeNewsQuery(query).length > 0;
}

/** Collapse a query for display without changing the normalized match rules. */
export function displayNewsQuery(query: string): string {
  return query
    .replace(INVISIBLE_CHARACTERS, '')
    .replace(UNICODE_SPACES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The display query when it is searchable, or an empty string when it is not. */
export function resolveNewsQuery(query: string): string {
  return hasNewsQuery(query) ? displayNewsQuery(query) : '';
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

/** Whether a normalized word sequence contains an exact contiguous phrase. */
export function containsNewsPhrase(
  words: readonly string[],
  phrase: readonly string[]
): boolean {
  if (phrase.length === 0 || phrase.length > words.length) return false;
  for (let start = 0; start <= words.length - phrase.length; start += 1) {
    if (phrase.every((word, index) => words[start + index] === word)) return true;
  }
  return false;
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
  const { tokens, phrases } = parseNewsQuery(query);
  if (tokens.length === 0) return true;
  const normalizedFields = fields
    .filter((field): field is string => typeof field === 'string' && field.length > 0)
    .map((field) => normalizeNewsText(field))
    .filter(Boolean);
  const haystack = normalizedFields.join(' ');
  const words = haystack ? haystack.split(' ') : [];
  return (
    tokens.every((token) => words.some((word) => matchesNewsWord(word, token))) &&
    phrases.every((phrase) =>
      normalizedFields.some((field) => containsNewsPhrase(field.split(' '), phrase))
    )
  );
}
