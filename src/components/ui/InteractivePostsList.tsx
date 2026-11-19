'use client';

import { BookOpen, Mail, Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { useEditContext } from '@/components/layout/useEditContext';
import { NewsArchiveResults } from '@/components/news/NewsArchiveResults';
import { NewsSearchField } from '@/components/ui/NewsSearchField';
import { useNewsSearch } from '@/hooks/useNewsSearch';
import { searchNewsPosts } from '@/lib/news-text';
import type { PublishedPostSummary } from '@/lib/queries/content';

interface InteractivePostsListProps {
  initialPosts: PublishedPostSummary[];
}

export function InteractivePostsList({ initialPosts }: InteractivePostsListProps) {
  const { isAdmin } = useEditContext('/news');
  const { searchQuery, setSearchQuery, effectiveQuery, searching, clearSearch } = useNewsSearch();
  const filteredPosts = useMemo(
    () => searchNewsPosts(initialPosts, effectiveQuery),
    [effectiveQuery, initialPosts]
  );

  return (
    <section aria-labelledby="latest-news-heading" className="space-y-8">
      <div className="civic-section-head">
        <div>
          <p className="civic-section-index">Chapter newsroom</p>
          <h2
            id="latest-news-heading"
            className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl"
          >
            Latest News
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
            Reports, statements, and dispatches from our chapter organizers — published here
            first.
          </p>
        </div>

        <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
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
        posts={filteredPosts}
        query={effectiveQuery}
        searching={searching}
        isAdmin={isAdmin}
        onClearSearch={clearSearch}
      />
    </section>
  );
}
