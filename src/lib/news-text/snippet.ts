import { matchesNewsWord, normalizeNewsText, tokenizeNewsQuery } from './normalize';

export type NewsTextSegment = {
  text: string;
  matched: boolean;
};

function matchesAnyToken(value: string, tokens: readonly string[]): boolean {
  const normalized = normalizeNewsText(value);
  if (!normalized) return false;
  const words = normalized.split(' ');
  return tokens.some((token) => words.some((word) => matchesNewsWord(word, token)));
}

/**
 * Split text into alternating plain and matched segments for safe React
 * rendering. The original spelling and punctuation are preserved exactly.
 */
export function splitNewsTextHighlights(text: string, query: string): NewsTextSegment[] {
  if (!text) return [];
  const tokens = tokenizeNewsQuery(query);
  if (tokens.length === 0) return [{ text, matched: false }];

  const segments: NewsTextSegment[] = [];
  const append = (value: string, matched: boolean) => {
    if (!value) return;
    const previous = segments[segments.length - 1];
    if (previous && previous.matched === matched) {
      previous.text += value;
      return;
    }
    segments.push({ text: value, matched });
  };

  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    append(part, part.trim() ? matchesAnyToken(part, tokens) : false);
  }
  return segments;
}

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
  const source = text.replace(/\s+/g, ' ').trim();
  if (!source || maxLength <= 0) return '';
  if (source.length <= maxLength) return source;

  const tokens = tokenizeNewsQuery(query);
  let matchStart = -1;
  let matchLength = 0;
  if (tokens.length > 0) {
    let offset = 0;
    for (const part of source.split(/(\s+)/)) {
      if (part && part.trim() && matchesAnyToken(part, tokens)) {
        matchStart = offset;
        matchLength = part.length;
        break;
      }
      offset += part.length;
    }
  }

  let start =
    matchStart === -1
      ? 0
      : Math.max(0, matchStart - Math.floor((maxLength - matchLength) / 2));
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
