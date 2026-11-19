import { analyzeNewsText, tidyNewsText, type NewsTextAnalysis } from './newsletter-stats';
import {
  reviewNewsText,
  type NewsTextReviewOptions,
  type NewsTextSuggestion,
} from './review';

/**
 * Everything an authoring surface needs from one text value.
 *
 * The summary editor previously analyzed the text for its count, analyzed it
 * again inside the review, and normalized it separately for the tidy action.
 * Composing those pure operations here keeps the measurements consistent and
 * lets any future field reuse the same feedback without importing React.
 */
export type NewsTextInspection = {
  analysis: NewsTextAnalysis;
  suggestions: NewsTextSuggestion[];
  /** Whitespace-normalized text; the caller decides whether to apply it. */
  tidied: string;
  canTidy: boolean;
};

export function inspectNewsText(
  value: string,
  options: NewsTextReviewOptions = {}
): NewsTextInspection {
  const analysis = options.analysis ?? analyzeNewsText(value);
  const tidied = tidyNewsText(value);

  return {
    analysis,
    suggestions: reviewNewsText(value, { ...options, analysis }),
    tidied,
    canTidy: Boolean(value.trim()) && tidied !== value,
  };
}
