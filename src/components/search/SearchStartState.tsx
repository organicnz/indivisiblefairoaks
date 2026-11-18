import { PopularLinks } from './PopularLinks';

export function SearchStartState() {
  return (
          <section aria-labelledby="search-start-heading" className="civic-panel civic-panel--muted p-8 sm:p-10">
            <p className="civic-section-index">Start here</p>
            <h2
              id="search-start-heading"
              className="mt-2 max-w-xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.035em]"
            >
              One index for the whole chapter.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Search articles, meeting notes, voter guides and chapter pages. Enter a word or
              phrase above, or start with one of the sections people look for most.
            </p>
            <PopularLinks className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-5" />
          </section>
  );
}
