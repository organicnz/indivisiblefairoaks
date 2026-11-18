'use client';

import { BookOpen, FileText, Mail, Plus, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useEditContext } from '@/components/layout/useEditContext';
import { LeadStory } from '@/components/news/LeadStory';
import { PostCard } from '@/components/news/PostCard';
import { filterNewsPosts, tokenizeNewsQuery } from '@/lib/news-text';
import type { PublishedPostSummary } from '@/lib/queries/content';

interface InteractivePostsListProps {
  initialPosts: PublishedPostSummary[];
}

export function InteractivePostsList({ initialPosts }: InteractivePostsListProps) {
  const { isAdmin } = useEditContext('/news');
  const [searchQuery, setSearchQuery] = useState('');
  const searching = tokenizeNewsQuery(searchQuery).length > 0;
  const filteredPosts = useMemo(
    () => filterNewsPosts(initialPosts, searchQuery),
    [initialPosts, searchQuery]
  );
  const [leadPost, ...supportingPosts] = filteredPosts;

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
          <div className="relative w-full sm:w-56">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-ink-muted-on-dark"
              size={14}
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search published news by title, excerpt, or slug"
              data-testid="news-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search news..."
              className="min-h-11 w-full border border-border bg-surface-card py-2 pl-9 pr-9 text-xs text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear news search"
                className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X size={13} aria-hidden="true" />
              </button>
            ) : null}
          </div>

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

      {searching ? (
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground" aria-live="polite">
            {filteredPosts.length} {filteredPosts.length === 1 ? 'story' : 'stories'} matching “
            {searchQuery.trim()}”
          </p>
          {filteredPosts.length === 0 ? (
            <div className="civic-panel p-8 text-center text-muted-foreground dark:text-ink-muted-on-dark">
              <Search className="mx-auto mb-3 opacity-40" size={32} aria-hidden="true" />
              <p className="text-sm">
                No published stories match “{searchQuery.trim()}”. Try a broader word or clear the
                search.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-4 inline-flex min-h-11 items-center gap-1.5 border border-border bg-surface-card px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X size={13} aria-hidden="true" />
                Clear search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {filteredPosts.map((post) => (
                <PostCard key={post.id} post={post} isAdmin={isAdmin} />
              ))}
            </div>
          )}
        </div>
      ) : !leadPost ? (
        <div className="civic-panel p-8 text-center text-muted-foreground dark:text-ink-muted-on-dark">
          <FileText className="mx-auto mb-3 opacity-40" size={32} aria-hidden="true" />
          <p className="text-sm">
            No published articles yet. Check back soon for deep-dive campaign reports and
            commentary!
          </p>
          {isAdmin ? (
            <Link
              href="/admin/content/new?type=post"
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 border border-primary bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Plus size={14} aria-hidden="true" />
              <span>Add the First News Post</span>
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="space-y-8">
          <LeadStory post={leadPost} isAdmin={isAdmin} />

          {supportingPosts.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {supportingPosts.map((post) => (
                <PostCard key={post.id} post={post} isAdmin={isAdmin} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
