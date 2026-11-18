'use client';

import { Loader2, Newspaper } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  type CivicNewsletterRecord,
  deleteCivicNewsletter,
  getCivicNewslettersAdmin,
} from '@/lib/actions/civic';
import { filterNewsletters, mergeNewsletterRows, sortNewsletters } from '@/lib/news-text';
import { NewsletterManagerRow } from '@/components/admin/news/NewsletterManagerRow';
import { NewsletterManagerToolbar } from '@/components/admin/news/NewsletterManagerToolbar';
import { CivicNewsletterEditorModal } from './CivicNewsletterEditorModal';

interface CivicNewsletterManagerProps {
  onRefreshParent?: () => void;
  /** Keep an in-progress visual-editing session alive by opening the CMS in a new tab. */
  newsLinkTarget?: '_self' | '_blank';
  /** Server-rendered rows, so the admin never sees a spinner for data it already has. */
  initialNewsletters?: CivicNewsletterRecord[];
}

export function CivicNewsletterManager({
  onRefreshParent,
  newsLinkTarget = '_self',
  initialNewsletters,
}: CivicNewsletterManagerProps) {
  const [newsletters, setNewsletters] = useState<CivicNewsletterRecord[]>(
    initialNewsletters ? sortNewsletters(initialNewsletters) : []
  );
  const [loading, setLoading] = useState(initialNewsletters === undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNewsletter, setEditingNewsletter] = useState<CivicNewsletterRecord | null>(null);

  const fetchNewsletters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCivicNewslettersAdmin();
      if (res.success && res.data) {
        setNewsletters(sortNewsletters(res.data));
      } else if (!res.success) {
        toast.error(res.error || 'Failed to load newsletters');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error fetching newsletters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // A server-rendered list is already the freshest answer this page has. The
    // old unconditional fetch replaced it with a second request on every mount.
    if (initialNewsletters === undefined) fetchNewsletters();
  }, [fetchNewsletters, initialNewsletters]);

  const handleDelete = async (slug: string) => {
    try {
      const res = await deleteCivicNewsletter(slug);
      if (res.success) {
        toast.success('Bulletin deleted');
        setNewsletters((prev) => prev.filter((newsletter) => newsletter.slug !== slug));
        onRefreshParent?.();
      } else {
        toast.error(res.error || 'Failed to delete bulletin');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error deleting bulletin');
    }
  };

  const filteredNewsletters = useMemo(
    () => filterNewsletters(newsletters, { query: searchQuery }),
    [newsletters, searchQuery]
  );

  const openCreate = () => {
    setEditingNewsletter(null);
    setIsEditorOpen(true);
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      <NewsletterManagerToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        loading={loading}
        onRefresh={() => void fetchNewsletters()}
        onAddNewsletter={openCreate}
        newsLinkTarget={newsLinkTarget}
      />

      <div className="min-h-[300px] flex-1 space-y-2.5 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 size={24} className="animate-spin text-primary" aria-hidden="true" />
            <span className="text-xs font-semibold">Loading newsletters...</span>
          </div>
        ) : filteredNewsletters.length === 0 ? (
          <div className="space-y-2 rounded-2xl border border-dashed border-border bg-surface-muted/30 p-8 py-16 text-center">
            <Newspaper
              size={28}
              className="mx-auto text-muted-foreground/60"
              aria-hidden="true"
            />
            <p className="text-sm font-bold text-foreground">No newsletters found</p>
            <p className="mx-auto max-w-sm text-xs text-muted-foreground">
              {searchQuery
                ? 'Try adjusting your search query.'
                : 'Publish your chapter’s first action bulletin or legislative summary.'}
            </p>
          </div>
        ) : (
          filteredNewsletters.map((newsletter) => (
            <NewsletterManagerRow
              key={newsletter.slug}
              newsletter={newsletter}
              onEdit={(item) => {
                setEditingNewsletter(item);
                setIsEditorOpen(true);
              }}
              onDelete={(slug) => void handleDelete(slug)}
            />
          ))
        )}
      </div>

      <CivicNewsletterEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        newsletter={editingNewsletter}
        onSaved={(saved, previousSlug) => {
          setNewsletters((previous) => mergeNewsletterRows(previous, saved, previousSlug));
          onRefreshParent?.();
        }}
      />
    </div>
  );
}
