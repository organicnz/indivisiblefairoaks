/**
 * Newsletter writing statistics and paste cleanup.
 *
 * These helpers are intentionally independent of React and Supabase so the
 * editor's live stats, the summary tidy action, and future preview surfaces all
 * measure the same text in the same way.
 */

const INVISIBLE_CHARACTERS = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;
const UNICODE_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

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

/** Count words for the editor's live text statistics. */
export function countNewsletterWords(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return (
    trimmed.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0
  );
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
export function splitNewsletterSentences(value: string): string[] {
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

/** Count sentences, treating an unpunctuated paragraph as one sentence. */
export function countNewsletterSentences(value: string): number {
  return splitNewsletterSentences(value).length;
}

/** Count paragraphs separated by one or more blank lines. */
export function countNewsletterParagraphs(value: string): number {
  const trimmed = value.replace(/\r\n?/g, '\n').trim();
  if (!trimmed) return 0;
  return trimmed
    .split(/\n[ \t]*\n/)
    .filter((paragraph) => paragraph.trim().length > 0).length;
}

/** Estimated reading time at a conventional 200 words per minute. */
export function estimateNewsletterReadingMinutes(value: string): number {
  const words = countNewsletterWords(value);
  return words === 0 ? 0 : Math.max(1, Math.ceil(words / 200));
}

export type NewsletterTextAnalysis = {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  readingMinutes: number;
  averageWordsPerSentence: number;
  longSentences: number;
};

/** Generic alias for news posts, card excerpts, and future authoring fields. */
export type NewsTextAnalysis = NewsletterTextAnalysis;

/** One live analysis pass for the editor stats and any future preview surface. */
export function analyzeNewsletterText(value: string): NewsletterTextAnalysis {
  const words = countNewsletterWords(value);
  const sentences = splitNewsletterSentences(value);
  return {
    characters: value.length,
    charactersNoSpaces: value.replace(/\s/g, '').length,
    words,
    sentences: sentences.length,
    paragraphs: countNewsletterParagraphs(value),
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.ceil(words / 200)),
    averageWordsPerSentence:
      sentences.length === 0 ? 0 : Math.round((words / sentences.length) * 10) / 10,
    longSentences: sentences.filter(
      (sentence) => countNewsletterWords(sentence) > NEWSLETTER_LONG_SENTENCE_WORDS
    ).length,
  };
}

/**
 * Normalize pasted prose without rewriting its meaning: line endings, runs of
 * spaces/tabs, spaces around newlines and excessive blank lines. Invisible
 * separators and non-breaking spaces are folded because they otherwise survive
 * a copy from email or a word processor and make the character count lie.
 */
export function tidyNewsletterText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE_CHARACTERS, '')
    .replace(UNICODE_SPACES, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Readable aliases for non-newsletter authoring surfaces. */
export const analyzeNewsText = analyzeNewsletterText;
export const tidyNewsText = tidyNewsletterText;
