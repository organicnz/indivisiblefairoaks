'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { NewsletterTopicFilter } from '@/components/newsletters/NewsletterTopicFilter';
import {
  type CivicNewsletterRecord,
  deleteCivicNewsletter,
  getCivicNewslettersAdmin,
} from '@/lib/actions/civic';
import { mergeNewsletterRows, sortNewsletters } from '@/lib/news-text';
import { NewsletterManagerResults } from '@/components/admin/news/NewsletterManagerResults';
import { NewsletterManagerToolbar } from '@/components/admin/news/NewsletterManagerToolbar';
import { NewsletterResultsSummary } from '@/components/newsletters/NewsletterResultsSummary';
import { useNewsletterArchive } from '@/hooks/useNewsletterArchive';
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
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNewsletter, setEditingNewsletter] = useState<CivicNewsletterRecord | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const {
    searchQuery,
    setSearchQuery,
    effectiveQuery,
    activeTopic,
    setActiveTopic,
    allTopicsLabel,
    allTopics,
    topicCounts,
    results,
    topicFiltered,
    filtering,
    clearFilters,
  } = useNewsletterArchive(newsletters);

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

  const openCreate = () => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingNewsletter(null);
    setIsEditorOpen(true);
  };

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
    // The editor is controlled from a button outside Radix's trigger tree, so
    // the dialog cannot restore focus itself. Return it to the control that
    // opened the editor after the dialog has unmounted.
    requestAnimationFrame(() => {
      const opener = openerRef.current;
      if (opener?.isConnected) opener.focus();
    });
  }, []);

  return (
    <div className="flex h-full flex-col space-y-4">
      <NewsletterManagerToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        loading={loading}
        onRefresh={() => void fetchNewsletters()}
        onAddNewsletter={openCreate}
        newsLinkTarget={newsLinkTarget}
        resultsId="admin-newsletter-results"
      />

      <NewsletterTopicFilter
        topics={allTopics}
        activeTopic={activeTopic}
        onTopicChange={setActiveTopic}
        resultsId="admin-newsletter-results"
        allTopicsLabel={allTopicsLabel}
        variant="admin"
        maxVisible={8}
        counts={topicCounts}
      />

      <NewsletterResultsSummary
        shown={results.length}
        total={newsletters.length}
        query={effectiveQuery}
        activeTopic={activeTopic}
        allTopicsLabel={allTopicsLabel}
        onClearFilters={clearFilters}
      />

      <NewsletterManagerResults
        loading={loading}
        newsletters={results}
        query={effectiveQuery}
        filtering={filtering}
        clearLabel={effectiveQuery && !topicFiltered ? 'Clear search' : 'Clear filters'}
        onClearFilters={clearFilters}
        onEdit={(item) => {
          openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setEditingNewsletter(item);
          setIsEditorOpen(true);
        }}
        onDelete={(slug) => void handleDelete(slug)}
      />

      <CivicNewsletterEditorModal
        isOpen={isEditorOpen}
        onClose={closeEditor}
        newsletter={editingNewsletter}
        onSaved={(saved, previousSlug) => {
          setNewsletters((previous) => mergeNewsletterRows(previous, saved, previousSlug));
          onRefreshParent?.();
        }}
      />
    </div>
  );
}
