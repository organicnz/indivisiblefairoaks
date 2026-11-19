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
