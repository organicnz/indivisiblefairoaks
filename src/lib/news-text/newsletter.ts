import { normalizeNewsletterTopics } from '@/lib/newsletters';
import type { NewsletterTextFields } from './search';

/** Stable archive order: explicit sort order first, then title. */
export function sortNewsletters<T extends NewsletterTextFields>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  );
}

/**
 * Replace the edited row and remove a stale slug after a rename.
 *
 * Both the public archive and the admin manager previously carried their own
 * filter-and-append logic. A rename changes the slug, so matching only the
 * saved slug left the old card behind and added a second one.
 */
export function mergeNewsletterRows<T extends NewsletterTextFields & { slug: string }>(
  items: readonly T[],
  saved: T,
  previousSlug: string | null
): T[] {
  const withoutOld = items.filter(
    (item) => item.slug !== saved.slug && (!previousSlug || item.slug !== previousSlug)
  );
  return sortNewsletters([...withoutOld, saved]);
}

/**
 * Parse a topic input that may contain a pasted comma/newline separated list.
 *
 * The editor used to treat the whole value as one topic, so pasting
 * "Election Defense, Choir Actions" created one impossible chip. Keeping the
 * parser here means the live preview and the submit path apply the same rule.
 */
export function parseNewsletterTopicInput(value: string): string[] {
  return normalizeNewsletterTopics(value.split(/[,;\n]+/));
}

/** Count words for the editor's live text statistics. */
export function countNewsletterWords(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

/** Count sentence-ending punctuation, treating unpunctuated copy as one sentence. */
export function countNewsletterSentences(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.match(/[.!?]+(?=\s|$)/g)?.length ?? 1;
}

/** Count paragraphs separated by one or more blank lines. */
export function countNewsletterParagraphs(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\n\s*\n/).filter((paragraph) => paragraph.trim().length > 0).length;
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
};

/** One live analysis pass for the editor stats and any future preview surface. */
export function analyzeNewsletterText(value: string): NewsletterTextAnalysis {
  return {
    characters: value.length,
    charactersNoSpaces: value.replace(/\s/g, '').length,
    words: countNewsletterWords(value),
    sentences: countNewsletterSentences(value),
    paragraphs: countNewsletterParagraphs(value),
    readingMinutes: estimateNewsletterReadingMinutes(value),
  };
}

/**
 * Normalize pasted prose without rewriting its meaning: line endings, runs of
 * spaces/tabs, spaces around newlines and excessive blank lines.
 */
export function tidyNewsletterText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
