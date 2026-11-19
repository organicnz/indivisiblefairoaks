import { FileText, Plus, Search, X } from 'lucide-react';
import Link from 'next/link';
import { LeadStory } from '@/components/news/LeadStory';
import { PostCard } from '@/components/news/PostCard';
import { SearchResultsSummary } from '@/components/ui/SearchResultsSummary';
import type { PublishedPostSummary } from '@/lib/queries/content';

type NewsArchiveResultsProps = {
  posts: PublishedPostSummary[];
  query: string;
  searching: boolean;
  isAdmin: boolean;
  onClearSearch: () => void;
};

/**
 * The three result shapes of the news archive: a searched grid, an honest
 * archive-empty state, and the editorial lead-story layout. Keeping this out of
 * `InteractivePostsList` leaves that component responsible for the masthead and
 * query state rather than for every branch of the feed.
 */
export function NewsArchiveResults({
  posts,
  query,
  searching,
  isAdmin,
  onClearSearch,
}: NewsArchiveResultsProps) {
  const [leadPost, ...supportingPosts] = posts;
  const searchQuery = query || undefined;

  if (searching) {
    return (
      <div id="news-results" className="space-y-4">
        <SearchResultsSummary
          count={posts.length}
          query={query}
          singular="story"
          plural="stories"
        />
        {posts.length === 0 ? (
          <div className="civic-panel p-8 text-center text-muted-foreground dark:text-ink-muted-on-dark">
            <Search className="mx-auto mb-3 opacity-40" size={32} aria-hidden="true" />
            <p className="text-sm">
              No published stories match “{query}”. Try a broader word or clear the search.
            </p>
            <button
              type="button"
              onClick={onClearSearch}
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 border border-border bg-surface-card px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={13} aria-hidden="true" />
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                isAdmin={isAdmin}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!leadPost) {
    return (
      <div
        id="news-results"
        className="civic-panel p-8 text-center text-muted-foreground dark:text-ink-muted-on-dark"
      >
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
    );
  }

  return (
    <div id="news-results" className="space-y-8">
      <LeadStory post={leadPost} isAdmin={isAdmin} searchQuery={searchQuery} />

      {supportingPosts.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {supportingPosts.map((post) => (
            <PostCard key={post.id} post={post} isAdmin={isAdmin} searchQuery={searchQuery} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
