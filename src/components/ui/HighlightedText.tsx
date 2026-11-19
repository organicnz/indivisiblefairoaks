import { Fragment } from 'react';
import { splitNewsTextHighlights } from '@/lib/news-text';

type HighlightedTextProps = {
  text: string;
  query?: string;
};

/**
 * Render query matches as React nodes instead of raw HTML. The original text
 * is preserved; only the segments that match the normalized search query
 * become semantic `<mark>` elements.
 */
export function HighlightedText({ text, query }: HighlightedTextProps) {
  if (!query) return <>{text}</>;
  const segments = splitNewsTextHighlights(text, query);
  if (!segments.some((segment) => segment.matched)) return <>{text}</>;

  return (
    <>
      {segments.map((segment, index) =>
        segment.matched ? (
          <mark
            key={index}
            className="rounded-[2px] bg-accent-gold/30 px-0.5 text-inherit [box-decoration-break:clone]"
          >
            {segment.text}
          </mark>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        )
      )}
    </>
  );
}
