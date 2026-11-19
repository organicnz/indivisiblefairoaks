import { NewsletterManagerRow } from '@/components/admin/news/NewsletterManagerRow';
import { NewsletterEmptyState } from '@/components/newsletters/NewsletterEmptyState';
import type { CivicNewsletterRecord } from '@/lib/actions/civic';

type NewsletterManagerResultsProps = {
  loading: boolean;
  newsletters: CivicNewsletterRecord[];
  query: string;
  filtering: boolean;
  clearLabel: string;
  onEdit: (newsletter: CivicNewsletterRecord) => void;
  onEmail: (newsletter: CivicNewsletterRecord) => void;
  onDelete: (slug: string) => void;
  onClearFilters: () => void;
};

/** The admin bulletin list's loading, empty and populated states. */
export function NewsletterManagerResults({
  loading,
  newsletters,
  query,
  filtering,
  clearLabel,
  onEdit,
  onEmail,
  onDelete,
  onClearFilters,
}: NewsletterManagerResultsProps) {
  return (
    <div
      id="admin-newsletter-results"
      className="min-h-[300px] flex-1 space-y-2.5 overflow-y-auto pr-1"
    >
      {loading ? (
        <NewsletterEmptyState variant="loading" admin />
      ) : newsletters.length === 0 ? (
        <NewsletterEmptyState
          variant={filtering ? 'filtered' : 'archive'}
          admin
          clearLabel={clearLabel}
          onClearFilters={onClearFilters}
        />
      ) : (
        newsletters.map((newsletter) => (
          <NewsletterManagerRow
            key={newsletter.slug}
            newsletter={newsletter}
            searchQuery={query || undefined}
            onEdit={onEdit}
            onEmail={onEmail}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );
}
