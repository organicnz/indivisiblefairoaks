import {
  collapseNewsWhitespace,
  findNewsPhrase,
  findNewsWords,
  matchesNewsWord,
  parseNewsQuery,
} from './normalize';

/**
 * Build a compact excerpt around the first matching word. This keeps search
 * results useful when the match sits deep in a long summary, and it returns the
 * original wording rather than the normalized haystack used for matching.
 */
export function buildNewsSearchSnippet(text: string, query: string, maxLength = 220): string {
  const source = collapseNewsWhitespace(text);
  if (!source || maxLength <= 0) return '';
  if (source.length <= maxLength) return source;

  const { tokens, phrases } = parseNewsQuery(query);
  // A whitespace-only or punctuation-only query is not a search. Returning the
  // source keeps the caller's normal excerpt instead of silently cropping it
  // from the front just because a snippet was requested.
  if (tokens.length === 0) return source;

  const words = findNewsWords(source);
  const normalizedWords = words.map((word) => word.word);
  let phraseMatch: { start: number; end: number } | null = null;
  for (const phrase of phrases) {
    const start = findNewsPhrase(normalizedWords, phrase);
    if (start < 0) continue;
    phraseMatch = {
      start: words[start].start,
      end: words[start + phrase.length - 1].end,
    };
    break;
  }

  // When the query contains a quoted phrase, only that phrase may justify
  // cropping this field. Falling back to a loose word from the phrase would
  // crop around a partial match even when the phrase was found in the title.
  const tokenMatch =
    !phraseMatch && phrases.length === 0
      ? words.find(({ word }) => tokens.some((token) => matchesNewsWord(word, token)))
      : null;
  const matchStart = phraseMatch?.start ?? tokenMatch?.start;

  // The query matched a different field (usually the title). Cropping this
  // text from the front would imply a match that is not here and add an
  // ellipsis to an excerpt the reader could have seen whole.
  if (matchStart === undefined) return source;

  const matchEnd = phraseMatch?.end ?? tokenMatch?.end ?? matchStart;
  const matchLength = matchEnd - matchStart;

  let start = Math.max(
    0,
    matchStart - Math.floor((maxLength - Math.min(matchLength, maxLength)) / 2)
  );
  if (start > 0) {
    const previousSpace = source.lastIndexOf(' ', start);
    start = previousSpace === -1 ? 0 : previousSpace + 1;
  }

  let end = Math.min(source.length, start + maxLength);
  if (end < source.length) {
    const previousSpace = source.lastIndexOf(' ', end);
    if (previousSpace > start) {
      end = previousSpace;
    } else {
      const nextSpace = source.indexOf(' ', end);
      end = nextSpace === -1 ? source.length : nextSpace;
    }
  }

  let snippet = source.slice(start, end).trim();
  if (start > 0) snippet = `… ${snippet}`;
  if (end < source.length) snippet = `${snippet} …`;
  return snippet;
}
