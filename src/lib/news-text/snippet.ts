import {
  collapseNewsWhitespace,
  findNewsWords,
  matchesNewsWord,
  parseNewsQuery,
} from './normalize';

/**
 * Build a compact excerpt around the first matching word. This keeps search
 * results useful when the match sits deep in a long summary, and it returns the
 * original wording rather than the normalized haystack used for matching.
 */
export function buildNewsSearchSnippet(
  text: string,
  query: string,
  maxLength = 220
): string {
  const source = collapseNewsWhitespace(text);
  if (!source || maxLength <= 0) return '';
  if (source.length <= maxLength) return source;

  const { tokens, phrases } = parseNewsQuery(query);
  // A whitespace-only or punctuation-only query is not a search. Returning the
  // source keeps the caller's normal excerpt instead of silently cropping it
  // from the front just because a snippet was requested.
  if (tokens.length === 0) return source;

  const words = findNewsWords(source);
  const phraseMatch = (() => {
    for (const phrase of phrases) {
      if (phrase.length === 0 || phrase.length > words.length) continue;
      for (let start = 0; start <= words.length - phrase.length; start += 1) {
        if (phrase.every((word, index) => words[start + index]?.word === word)) {
          return {
            start: words[start].start,
            end: words[start + phrase.length - 1].end,
          };
        }
      }
    }
    return null;
  })();

  // When the query contains a quoted phrase, only that phrase may justify
  // cropping this field. Falling back to a loose word from the phrase would
  // crop around a partial match even when the phrase was found in the title.
  const tokenMatch =
    phraseMatch || phrases.length > 0
      ? null
      : words.find(({ word }) => tokens.some((token) => matchesNewsWord(word, token)));
  const matchStart = phraseMatch?.start ?? tokenMatch?.start ?? -1;
  const matchLength = phraseMatch
    ? phraseMatch.end - phraseMatch.start
    : tokenMatch
      ? tokenMatch.end - tokenMatch.start
      : 0;

  // The query matched a different field (usually the title). Cropping this
  // text from the front would imply a match that is not here and add an
  // ellipsis to an excerpt the reader could have seen whole.
  if (matchStart === -1) return source;

  let start =
    Math.max(
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
