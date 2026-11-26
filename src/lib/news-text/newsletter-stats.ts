/**
 * Shared writing statistics and paste cleanup.
 *
 * These helpers are intentionally independent of React and Supabase so the
 * editor's live stats, the summary tidy action, and future preview surfaces all
 * measure the same text in the same way.
 */

import { INVISIBLE_CHARACTERS, UNICODE_SPACES } from './normalize';

const WORDS_PER_MINUTE = 200;

/**
 * Sentence segmentation is delegated to `Intl.Segmenter` when the runtime
 * provides it. It handles closing quotes, decimals, and abbreviations far
 * better than a punctuation regex. The regex fallback keeps older browsers and
 * constrained runtimes working instead of failing the whole editor.
 */
const sentenceSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('en', { granularity: 'sentence' })
    : null;

function countWords(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

/** Long enough to be hard to scan in a bulletin summary. */
export const NEWSLETTER_LONG_SENTENCE_WORDS = 28;

/**
 * Split prose into sentences, one paragraph at a time.
 *
 * `Intl.Segmenter` is good at abbreviations and decimals, but it treats a
 * paragraph break as a boundary without closing the sentence. The previous
 * counter therefore merged "A heading\n\nA complete sentence." into one
 * sentence. Splitting paragraph blocks first keeps an unpunctuated paragraph
 * as one sentence and stops it swallowing the next paragraph.
 */
function splitSentences(value: string): string[] {
  const normalized = value.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const sentences: string[] = [];
  for (const paragraph of normalized.split(/\n[ \t]*\n/)) {
    const text = paragraph.trim();
    if (!text) continue;

    if (sentenceSegmenter) {
      const segments = Array.from(sentenceSegmenter.segment(text), (part) =>
        part.segment.trim()
      ).filter(Boolean);
      if (segments.length > 0) {
        sentences.push(...segments);
        continue;
      }
    }

    const fallback = text.match(/[^.!?]+[.!?]+(?:["'”’)\]]+)?|[^.!?]+$/g) ?? [text];
    sentences.push(...fallback.map((sentence) => sentence.trim()).filter(Boolean));
  }

  return sentences;
}

function countParagraphs(value: string): number {
  const trimmed = value.replace(/\r\n?/g, '\n').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\n[ \t]*\n/).filter((paragraph) => paragraph.trim().length > 0).length;
}

function readingMinutes(words: number): number {
  return words === 0 ? 0 : Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export type NewsTextAnalysis = {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  readingMinutes: number;
  averageWordsPerSentence: number;
  longSentences: number;
};

/** One live analysis pass for the editor stats and any future preview surface. */
export function analyzeNewsText(value: string): NewsTextAnalysis {
  const words = countWords(value);
  const sentences = splitSentences(value);
  return {
    characters: value.length,
    charactersNoSpaces: value.replace(/\s/g, '').length,
    words,
    sentences: sentences.length,
    paragraphs: countParagraphs(value),
    readingMinutes: readingMinutes(words),
    averageWordsPerSentence:
      sentences.length === 0 ? 0 : Math.round((words / sentences.length) * 10) / 10,
    longSentences: sentences.filter(
      (sentence) => countWords(sentence) > NEWSLETTER_LONG_SENTENCE_WORDS
    ).length,
  };
}

/**
 * Normalize pasted prose without rewriting its meaning: line endings, runs of
 * spaces/tabs, spaces around newlines and excessive blank lines. Invisible
 * separators and non-breaking spaces are folded because they otherwise survive
 * a copy from email or a word processor and make the character count lie.
 */
export function tidyNewsText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE_CHARACTERS, '')
    .replace(UNICODE_SPACES, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
