import { Loader2, Newspaper, Search, X } from 'lucide-react';
import { NewsletterManagerRow } from '@/components/admin/news/NewsletterManagerRow';
import type { CivicNewsletterRecord } from '@/lib/actions/civic';

type NewsletterManagerResultsProps = {
  loading: boolean;
  newsletters: CivicNewsletterRecord[];
  query: string;
  onEdit: (newsletter: CivicNewsletterRecord) => void;
  onDelete: (slug: string) => void;
  onClearSearch: () => void;
};

/** The admin bulletin list's loading, empty and populated states. */
export function NewsletterManagerResults({
  loading,
  newsletters,
  query,
  onEdit,
  onDelete,
  onClearSearch,
}: NewsletterManagerResultsProps) {
  return (
    <div
      id="admin-newsletter-results"
      className="min-h-[300px] flex-1 space-y-2.5 overflow-y-auto pr-1"
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 size={24} className="animate-spin text-primary" aria-hidden="true" />
          <span className="text-xs font-semibold">Loading newsletters...</span>
        </div>
      ) : newsletters.length === 0 ? (
        <div className="space-y-2 rounded-2xl border border-dashed border-border bg-surface-muted/30 p-8 py-16 text-center">
          {query ? (
            <>
              <Search
                size={28}
                className="mx-auto text-muted-foreground/60"
                aria-hidden="true"
              />
              <p className="text-sm font-bold text-foreground">No newsletters found</p>
              <p className="mx-auto max-w-sm text-xs text-muted-foreground">
                Try a broader word, or clear the search to see the complete archive.
              </p>
              <button
                type="button"
                onClick={onClearSearch}
                className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X size={13} aria-hidden="true" />
                Clear search
              </button>
            </>
          ) : (
            <>
              <Newspaper
                size={28}
                className="mx-auto text-muted-foreground/60"
                aria-hidden="true"
              />
              <p className="text-sm font-bold text-foreground">No newsletters found</p>
              <p className="mx-auto max-w-sm text-xs text-muted-foreground">
                Publish your chapter&rsquo;s first action bulletin or legislative summary.
              </p>
            </>
          )}
        </div>
      ) : (
        newsletters.map((newsletter) => (
          <NewsletterManagerRow
            key={newsletter.slug}
            newsletter={newsletter}
            searchQuery={query || undefined}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );
}
