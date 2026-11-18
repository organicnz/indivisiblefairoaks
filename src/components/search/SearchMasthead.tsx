import { ArrowRight, Search } from 'lucide-react';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE_DOCUMENT,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { DataPoint } from '@/components/ui/DataPoint';

type SearchMastheadProps = {
  query: string;
  dataPoints: Record<string, string>;
};

export function SearchMasthead({ query: q, dataPoints }: SearchMastheadProps) {
  return (
      <PageMasthead
        compact
        icon={Search}
        eyebrow={
          <DataPoint name="search.header.eyebrow" initialData={dataPoints}>
            Search the chapter
          </DataPoint>
        }
        title={
          <h1 className={MASTHEAD_TITLE_DOCUMENT}>
            <DataPoint name="search.header.title" initialData={dataPoints}>
              Search Results
            </DataPoint>
          </h1>
        }
        intro={
          <p className={MASTHEAD_INTRO}>
            {q ? (
              <>
                Results for <span className="font-semibold text-foreground">&ldquo;{q}&rdquo;</span>{' '}
                across the chapter archive.
              </>
            ) : (
              'Find actions, meeting minutes, voter guides, newsletters and pages from across the chapter.'
            )}
          </p>
        }
        meta={
          <form
            action="/search"
            method="get"
            role="search"
            className="civic-form flex w-full max-w-xl flex-col gap-2 sm:flex-row"
          >
            <label htmlFor="site-search" className="sr-only">
              Search the chapter
            </label>
            <input
              id="site-search"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search actions, minutes, guides, pages…"
              className="min-w-0 flex-1 px-4"
            />
            <button
              type="submit"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 border border-primary bg-primary px-5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Search
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </form>
        }
      />
  );
}
