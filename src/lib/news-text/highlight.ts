import { findNewsWords, matchesNewsWord, parseNewsQuery } from './normalize';

export type NewsTextSegment = {
  text: string;
  matched: boolean;
};

type TextRange = {
  start: number;
  end: number;
};

/**
 * Split text into alternating plain and matched segments for safe React
 * rendering. The original spelling and punctuation are preserved exactly.
 *
 * Quoted phrases are highlighted as one continuous run rather than a set of
 * separate words, so a reader can see that "public schools" was searched for
 * as a phrase. Unquoted tokens still mark each matching word independently.
 */
export function splitNewsTextHighlights(text: string, query: string): NewsTextSegment[] {
  if (!text) return [];
  const { tokens, phrases } = parseNewsQuery(query);
  if (tokens.length === 0) return [{ text, matched: false }];

  const words = findNewsWords(text);
  const ranges: TextRange[] = [];

  for (const phrase of phrases) {
    if (phrase.length === 0 || phrase.length > words.length) continue;
    for (let start = 0; start <= words.length - phrase.length; start += 1) {
      if (phrase.every((word, index) => words[start + index]?.word === word)) {
        ranges.push({
          start: words[start].start,
          end: words[start + phrase.length - 1].end,
        });
        start += phrase.length - 1;
      }
    }
  }

  for (const word of words) {
    if (tokens.some((token) => matchesNewsWord(word.word, token))) {
      ranges.push({ start: word.start, end: word.end });
    }
  }

  if (ranges.length === 0) return [{ text, matched: false }];

  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: TextRange[] = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
      continue;
    }
    merged.push({ ...range });
  }

  const segments: NewsTextSegment[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) {
      segments.push({ text: text.slice(cursor, range.start), matched: false });
    }
    segments.push({ text: text.slice(range.start, range.end), matched: true });
    cursor = range.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), matched: false });
  }
  return segments;
}
