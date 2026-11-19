'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CivicNewsletterEditorModal } from '@/components/admin/civic/CivicNewsletterEditorModal';
import { useEditContext } from '@/components/layout/useEditContext';
import { NewsletterCard } from '@/components/newsletters/NewsletterCard';
import { NewsletterEmptyState } from '@/components/newsletters/NewsletterEmptyState';
import { NewsletterFilterBar } from '@/components/newsletters/NewsletterFilterBar';
import { NewsletterResultsSummary } from '@/components/newsletters/NewsletterResultsSummary';
import { useDataPoints } from '@/hooks/useDataPoints';
import { useNewsletterArchive } from '@/hooks/useNewsletterArchive';
import { type CivicNewsletterRecord, deleteCivicNewsletter } from '@/lib/actions/civic';
import { ALL_NEWSLETTER_TOPICS, mergeNewsletterRows, sortNewsletters } from '@/lib/news-text';
import type { NewsletterRow } from '@/lib/queries/civic';

export function InteractiveNewslettersList({
  initialNewsletters,
  initialData,
}: {
  initialNewsletters?: NewsletterRow[];
  initialData?: Record<string, string>;
} = {}) {
  const { dataPoints } = useDataPoints('news', initialData);
  const { isAdmin } = useEditContext('/news');

  const [newslettersList, setNewslettersList] = useState<NewsletterRow[]>(() =>
    sortNewsletters(initialNewsletters ?? [])
  );
  const [selectedNewsletterForEdit, setSelectedNewsletterForEdit] =
    useState<CivicNewsletterRecord | null>(null);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const allTopicsLabel = dataPoints['news.topic.all'] || ALL_NEWSLETTER_TOPICS;
  const {
    searchQuery,
    setSearchQuery,
    effectiveQuery,
    activeTopic,
    setActiveTopic,
    allTopics,
    topicCounts,
    results: filteredNewsletters,
    clearFilters,
  } = useNewsletterArchive(newslettersList, { allTopicsLabel });

  useEffect(() => {
    // The page already renders the cached server list. Re-fetching it on every
    // mount added a second request and could replace fresh server data with a
    // minutes-old cached API response. Only the caller without server data
    // needs the fallback.
    if (initialNewsletters !== undefined) return;
    let cancelled = false;
    async function loadNewslettersFromApi() {
      try {
        const res = await fetch('/api/civic/newsletters');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data.newsletters)) {
            setNewslettersList(sortNewsletters(data.newsletters));
          }
        }
      } catch {
        // Keep the honest empty state rather than inventing rows.
      }
    }
    void loadNewslettersFromApi();
    return () => {
      cancelled = true;
    };
  }, [initialNewsletters]);

  const handleOpenCreateModal = () => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedNewsletterForEdit(null);
    setIsEditorModalOpen(true);
  };

  const handleOpenEditModal = (item: NewsletterRow) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedNewsletterForEdit({
      slug: item.slug,
      title: item.title,
      date_label: item.date_label,
      description: item.description,
      topics: item.topics,
      sort_order: item.sort_order ?? 10,
      // Preserve the real timestamp: this record feeds the edit form, and a
      // null here used to reset the bulletin to "now" whenever it was edited.
      published_at: item.published_at ?? null,
    });
    setIsEditorModalOpen(true);
  };

  const closeEditor = () => {
    setIsEditorModalOpen(false);
    // The edit button lives outside Radix's trigger tree. Without this, closing
    // the controlled dialog leaves focus on the document body.
    requestAnimationFrame(() => {
      const opener = openerRef.current;
      if (opener?.isConnected) opener.focus();
    });
  };

  const handleDeleteNewsletter = async (slug: string, title: string) => {
    try {
      // One authenticated path for both admin surfaces. The old API-first flow
      // could report a 200 from a delete that matched no row, and its fallback
      // made the same click write through two different clients.
      const result = await deleteCivicNewsletter(slug);
      if (result.success) {
        setNewslettersList((prev) => prev.filter((item) => item.slug !== slug));
        toast.success(`Bulletin "${title}" deleted`);
        return;
      }
      toast.error(result.error || 'Failed to delete bulletin');
    } catch {
      toast.error('Failed to delete bulletin');
    }
  };

  const handleNewsletterSaved = (
    savedRecord: CivicNewsletterRecord,
    previousSlug: string | null
  ) => {
    setIsEditorModalOpen(false);
    const updated: NewsletterRow = {
      slug: savedRecord.slug,
      title: savedRecord.title,
      date_label: savedRecord.date_label,
      description: savedRecord.description,
      topics: savedRecord.topics,
      sort_order: savedRecord.sort_order,
      published_at: savedRecord.published_at ?? null,
    };

    setNewslettersList((prev) => mergeNewsletterRows(prev, updated, previousSlug));
    toast.success(`Bulletin "${savedRecord.title}" saved successfully`);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <NewsletterFilterBar
          dataPoints={dataPoints}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          topics={allTopics}
          topicCounts={topicCounts}
          activeTopic={activeTopic}
          onTopicChange={setActiveTopic}
          onAdd={isAdmin ? handleOpenCreateModal : undefined}
          resultsId="newsletter-results"
          allTopicsLabel={allTopicsLabel}
        />
        <NewsletterResultsSummary
          shown={filteredNewsletters.length}
          total={newslettersList.length}
          query={effectiveQuery}
          activeTopic={activeTopic}
          allTopicsLabel={allTopicsLabel}
          onClearFilters={clearFilters}
        />
      </div>

      <div id="newsletter-results" className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {newslettersList.length === 0 ? (
          <NewsletterEmptyState variant="archive" dataPoints={dataPoints} />
        ) : filteredNewsletters.length === 0 ? (
          <NewsletterEmptyState
            variant="filtered"
            dataPoints={dataPoints}
            onClearFilters={clearFilters}
          />
        ) : (
          filteredNewsletters.map((newsletter) => (
            <NewsletterCard
              key={newsletter.slug || newsletter.title}
              newsletter={newsletter}
              dataPoints={dataPoints}
              isAdmin={isAdmin}
              onEdit={handleOpenEditModal}
              onDelete={(slug, title) => void handleDeleteNewsletter(slug, title)}
              searchQuery={effectiveQuery || undefined}
            />
          ))
        )}
      </div>

      {isEditorModalOpen ? (
        <CivicNewsletterEditorModal
          isOpen={isEditorModalOpen}
          onClose={closeEditor}
          newsletter={selectedNewsletterForEdit}
          onSaved={handleNewsletterSaved}
        />
      ) : null}
    </div>
  );
}
