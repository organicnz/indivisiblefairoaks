import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';
import type { RankedContentRow } from '@/lib/queries/search';
import { resultDate } from './search-data';

type SearchResultsProps = {
  posts: RankedContentRow[];
  dataPoints: Record<string, string>;
};

export function SearchResults({ posts, dataPoints }: SearchResultsProps) {
  return (
            <section aria-labelledby="search-results-heading">
              <div className="civic-section-head">
                <div>
                  <p className="civic-section-index">Archive index</p>
                  <h2
                    id="search-results-heading"
                    className="mt-2 font-display text-3xl font-semibold leading-tight tracking-[-0.03em]"
                  >
                    <DataPoint name="search.results.logbook" as="span" initialData={dataPoints}>
                      From the logbook &amp; pages
                    </DataPoint>
                  </h2>
                </div>
                <p className="civic-lede">
                  {posts.length} {posts.length === 1 ? 'result' : 'results'} found. Open an entry
                  to read the full page.
                </p>
              </div>

              <ol className="border-y border-border">
                {posts.map((post) => {
                  const date = resultDate(post.created_at);
                  return (
                    <li key={post.id} className="border-b border-border last:border-b-0">
                      <Link
                        href={`/${post.slug}`}
                        className="group grid gap-3 py-5 transition-colors hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:grid-cols-[7.5rem_minmax(0,1fr)_1.5rem] sm:items-start sm:gap-6 dark:hover:text-primary-on-dark"
                      >
                        <span className="flex flex-wrap items-baseline gap-2 sm:flex-col sm:items-start">
                          <span className="civic-stamp">{post.type || 'Page'}</span>
                          {date ? <span className="civic-meta">{date}</span> : null}
                        </span>
                        <span className="font-display text-2xl font-semibold leading-tight tracking-[-0.025em] text-foreground transition-colors group-hover:text-primary-ink dark:group-hover:text-primary-on-dark">
                          {post.title}
                        </span>
                        <ArrowRight
                          size={17}
                          aria-hidden="true"
                          className="hidden text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary-ink sm:block sm:justify-self-end sm:pt-1 dark:group-hover:text-primary-on-dark"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
  );
}
