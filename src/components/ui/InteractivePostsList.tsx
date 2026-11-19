'use client';

import { BookOpen, ChevronDown, Mail, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { SECTION_TITLE } from '@/components/layout/PageMasthead';
import { useEditContext } from '@/components/layout/useEditContext';
import { NewsArchiveResults } from '@/components/news/NewsArchiveResults';
import { NEWS_SEARCH_HINT, NewsSearchField } from '@/components/ui/NewsSearchField';
import { useNewsSearch } from '@/hooks/useNewsSearch';
import { searchNewsPosts } from '@/lib/news-text';
import type { PublishedPostSummary } from '@/lib/queries/content';

interface InteractivePostsListProps {
  initialPosts: PublishedPostSummary[];
}

/** The lead story plus ten cards: the same first screen `/news` used to fetch. */
const INITIAL_VISIBLE_POSTS = 11;

export function InteractivePostsList({ initialPosts }: InteractivePostsListProps) {
  const { isAdmin } = useEditContext('/news');
  const { searchQuery, setSearchQuery, effectiveQuery, searching, clearSearch } = useNewsSearch(
    '',
    { urlParam: 'q' }
  );
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_POSTS);
  const filteredPosts = useMemo(
    () => searchNewsPosts(initialPosts, effectiveQuery),
    [effectiveQuery, initialPosts]
  );
  // Search is archive-wide and must not be cropped by the browse limit.
  const visiblePosts = searching ? filteredPosts : filteredPosts.slice(0, visibleCount);
  const hasOlderPosts = !searching && visibleCount < filteredPosts.length;

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_POSTS);
  }, [initialPosts]);

  return (
    <section aria-labelledby="latest-news-heading">
      <div className="civic-section-head civic-section-head--compact">
        <div>
          <p className="civic-section-index">Chapter newsroom</p>
          <h2 id="latest-news-heading" className={`mt-2 ${SECTION_TITLE}`}>
            Latest News
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
            Reports, statements, and dispatches from our chapter organizers — published here first.
            Search the full published archive, or load older stories below.
          </p>
        </div>

        <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 md:col-span-2 md:justify-start lg:col-span-1 lg:col-start-2 lg:justify-end">
          <NewsSearchField
            variant="news"
            className="w-full sm:w-56"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search news..."
            ariaLabel="Search published news by title, excerpt, or slug"
            testId="news-search"
            clearLabel="Clear news search"
            resultsId="news-results"
            hint={NEWS_SEARCH_HINT}
          />

          <a
            href="mailto:contact@indivisiblefairoaks.org?subject=Chapter%20news%20submission"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 border border-border bg-surface-card px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Mail size={14} aria-hidden="true" />
            <span>Submit chapter news</span>
          </a>
          {isAdmin ? (
            <>
              <Link
                href="/admin/news#news-publishing-guide"
                className="inline-flex min-h-11 items-center justify-center gap-1.5 border border-border bg-surface-card px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <BookOpen size={14} aria-hidden="true" />
                <span>How to publish</span>
              </Link>
              <Link
                href="/admin/content/new?type=post"
                className="inline-flex min-h-11 items-center justify-center gap-1.5 border border-primary bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Plus size={15} aria-hidden="true" />
                <span>Add News</span>
              </Link>
            </>
          ) : null}
        </div>
      </div>

      <NewsArchiveResults
        posts={visiblePosts}
        query={effectiveQuery}
        searching={searching}
        isAdmin={isAdmin}
        onClearSearch={clearSearch}
      />

      {!searching && filteredPosts.length > INITIAL_VISIBLE_POSTS ? (
        <div className="mt-6 flex flex-col items-center gap-3 border-t border-border pt-6">
          {hasOlderPosts ? (
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + INITIAL_VISIBLE_POSTS)}
              aria-controls="news-results"
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-border bg-surface-card px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronDown size={15} aria-hidden="true" />
              Load older stories
            </button>
          ) : null}
          <p aria-live="polite" className="text-[11px] text-muted-foreground">
            Showing {visiblePosts.length} of {filteredPosts.length} published stories
          </p>
        </div>
      ) : null}
    </section>
  );
}
