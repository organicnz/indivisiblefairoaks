import { ArrowRight, Search } from 'lucide-react';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';
import { PopularLinks } from './PopularLinks';

type SearchEmptyStateProps = {
  dataPoints: Record<string, string>;
};

export function SearchEmptyState({ dataPoints }: SearchEmptyStateProps) {
  return (
            <section aria-labelledby="search-empty-heading" className="civic-panel civic-panel--muted p-8 sm:p-10">
              <Search
                size={24}
                aria-hidden="true"
                className="text-primary-ink dark:text-primary-on-dark"
              />
              <h2
                id="search-empty-heading"
                className="mt-4 font-display text-3xl font-semibold tracking-[-0.03em]"
              >
                <DataPoint name="search.empty.desc" initialData={dataPoints}>
                  No matches found.
                </DataPoint>
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Try a shorter phrase, a name, a location or a topic. The chapter archive uses the
                same words as the pages themselves.
              </p>
              <PopularLinks className="mt-6 flex flex-wrap gap-x-6 gap-y-2" />
              <Link
                href="/news"
                className="mt-6 inline-flex min-h-11 items-center gap-1.5 border border-primary bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <DataPoint name="search.empty.btn" initialData={dataPoints}>
                  Browse the newsroom
                </DataPoint>
                <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </section>
  );
}
