import { NEWSLETTER_CARD_EXCERPT_LENGTH } from './newsletter';
import {
  analyzeNewsText,
  NEWSLETTER_LONG_SENTENCE_WORDS,
  type NewsTextAnalysis,
  tidyNewsText,
} from './newsletter-stats';
import { normalizeNewsText } from './normalize';

export type NewsTextSuggestionTone = 'info' | 'warning';

export type NewsTextSuggestion = {
  id: 'card-length' | 'long-sentence' | 'repeated-word' | 'short' | 'ending-punctuation';
  tone: NewsTextSuggestionTone;
  message: string;
};

export type NewsTextReviewOptions = {
  /** How much of the summary the public card can show before it clamps. */
  cardLength?: number;
};

const STOP_WORDS = new Set(
  `about after again against also and are because been before being both but can could did
  does for from had has have her here him his how into its more most not now our out over
  she should some than that the their them then there these they this those through today
  too under until very was were what when where which while who why will with would you your`.split(
    /\s+/
  )
);

function repeatedContentWord(value: string): { word: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const word of normalizeNewsText(value).split(' ')) {
    if (word.length < 4 || STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  let repeated: { word: string; count: number } | null = null;
  for (const [word, count] of counts) {
    if (count < 3) continue;
    if (!repeated || count > repeated.count) repeated = { word, count };
  }
  return repeated;
}

/**
 * Review a card summary for the problems that make it hard to scan.
 *
 * These are deliberately editorial signals, not hard validation: the editor
 * still owns the wording. Suggestions are ordered by impact and capped so the
 * field does not turn into a wall of warnings while someone types.
 */
function reviewPreparedNewsText(
  value: string,
  options: NewsTextReviewOptions,
  analysis: NewsTextAnalysis
): NewsTextSuggestion[] {
  const text = value.trim();
  if (!text) return [];

  const cardLength = Math.max(1, Math.floor(options.cardLength ?? NEWSLETTER_CARD_EXCERPT_LENGTH));
  const suggestions: NewsTextSuggestion[] = [];

  if (text.length > cardLength) {
    suggestions.push({
      id: 'card-length',
      tone: 'warning',
      message: `This summary is ${text.length} characters. The public card shows about ${cardLength}; put the essential who, what, and why in the opening.`,
    });
  }

  if (analysis.longSentences > 0) {
    suggestions.push({
      id: 'long-sentence',
      tone: 'warning',
      message: `Split ${analysis.longSentences} sentence${
        analysis.longSentences === 1 ? '' : 's'
      } longer than ${NEWSLETTER_LONG_SENTENCE_WORDS} words so the card is easier to scan.`,
    });
  }

  const repeated = repeatedContentWord(text);
  if (repeated) {
    suggestions.push({
      id: 'repeated-word',
      tone: 'info',
      message: `“${repeated.word}” appears ${repeated.count} times. Vary the wording or cut the repetition.`,
    });
  }

  if (analysis.words < 8) {
    suggestions.push({
      id: 'short',
      tone: 'info',
      message:
        'Add one or two sentences of context so readers know what happened and why it matters.',
    });
  }

  if (analysis.words >= 8 && !/[.!?]["'”’)\]]?$/.test(text)) {
    suggestions.push({
      id: 'ending-punctuation',
      tone: 'info',
      message: 'Add ending punctuation so the summary reads as a finished thought.',
    });
  }

  return suggestions.slice(0, 3);
}

export type NewsTextInspection = {
  analysis: NewsTextAnalysis;
  suggestions: NewsTextSuggestion[];
  /** Whitespace-normalized text; the caller decides whether to apply it. */
  tidied: string;
  canTidy: boolean;
};

/** Everything an authoring surface needs from one text value. */
export function inspectNewsText(
  value: string,
  options: NewsTextReviewOptions = {}
): NewsTextInspection {
  const analysis = analyzeNewsText(value);
  const tidied = tidyNewsText(value);

  return {
    analysis,
    suggestions: reviewPreparedNewsText(value, options, analysis),
    tidied,
    canTidy: Boolean(value.trim()) && tidied !== value,
  };
}
