import { HighlightedText } from '@/components/ui/HighlightedText';
import { buildNewsSearchSnippet } from '@/lib/news-text';

type NewsSearchExcerptProps = {
  text: string | null | undefined;
  query?: string;
  maxLength: number;
};

/**
 * Render an excerpt that is cropped around the query only when the query
 * actually matches this text. When the match was in the title, `text` stays
 * whole and the card can clamp it visually instead of manufacturing a snippet.
 */
export function NewsSearchExcerpt({ text, query, maxLength }: NewsSearchExcerptProps) {
  if (!text) return null;
  const excerpt = query ? buildNewsSearchSnippet(text, query, maxLength) : text;
  return <HighlightedText text={excerpt} query={query} />;
}
