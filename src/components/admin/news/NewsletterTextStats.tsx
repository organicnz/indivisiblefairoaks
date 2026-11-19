import type { NewsletterTextAnalysis } from '@/lib/news-text';

type NewsletterTextStatsProps = {
  analysis: NewsletterTextAnalysis;
};

/** Live readability stats for the plain-text bulletin summary. */
export function NewsletterTextStats({ analysis }: NewsletterTextStatsProps) {
  if (analysis.words === 0) return null;

  return (
    <span>
      {analysis.words} {analysis.words === 1 ? 'word' : 'words'} · {analysis.sentences}{' '}
      {analysis.sentences === 1 ? 'sentence' : 'sentences'} · {analysis.readingMinutes} min read.
    </span>
  );
}
