import {
  NEWSLETTER_LONG_SENTENCE_WORDS,
  type NewsTextAnalysis,
} from '@/lib/news-text';

type NewsTextStatsProps = {
  analysis: NewsTextAnalysis;
};

/** Live readability stats for any editable news or bulletin summary. */
export function NewsTextStats({ analysis }: NewsTextStatsProps) {
  if (analysis.words === 0) return null;

  return (
    <span>
      {analysis.words} {analysis.words === 1 ? 'word' : 'words'} · {analysis.sentences}{' '}
      {analysis.sentences === 1 ? 'sentence' : 'sentences'} · {analysis.readingMinutes} min read
      {analysis.paragraphs > 1 ? ` · ${analysis.paragraphs} paragraphs` : ''}
      {analysis.longSentences > 0 ? (
        <>
          {' · '}
          <span
            className="font-bold text-amber-700 dark:text-amber-300"
            title={`Sentences longer than ${NEWSLETTER_LONG_SENTENCE_WORDS} words can be harder to scan.`}
          >
            {analysis.longSentences} long {analysis.longSentences === 1 ? 'sentence' : 'sentences'}
          </span>
        </>
      ) : null}
      {'.'}
    </span>
  );
}
