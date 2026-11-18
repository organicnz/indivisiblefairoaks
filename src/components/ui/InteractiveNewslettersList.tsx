'use client';

import { ArrowRight, PenLine, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { CivicNewsletterEditorModal } from '@/components/admin/civic/CivicNewsletterEditorModal';
import { useEditContext } from '@/components/layout/useEditContext';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';
import { type CivicNewsletterRecord, deleteCivicNewsletter } from '@/lib/actions/civic';
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

  const [newslettersList, setNewslettersList] = useState<NewsletterRow[]>(initialNewsletters ?? []);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState('All Topics');
  const [selectedNewsletterForEdit, setSelectedNewsletterForEdit] =
    useState<CivicNewsletterRecord | null>(null);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);

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
            setNewslettersList(data.newsletters);
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

  // Extract all unique topics
  const allTopics = useMemo(() => {
    const set = new Set<string>();
    for (const item of newslettersList) {
      if (Array.isArray(item.topics)) {
        for (const t of item.topics) {
          if (t.trim()) set.add(t.trim());
        }
      }
    }
    return ['All Topics', ...Array.from(set)];
  }, [newslettersList]);

  const filteredNewsletters = useMemo(() => {
    return newslettersList.filter((item) => {
      const matchesTopic =
        activeTopic === 'All Topics' ||
        (Array.isArray(item.topics) && item.topics.includes(activeTopic));
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        (Array.isArray(item.topics) && item.topics.some((t) => t.toLowerCase().includes(query)));
      return matchesTopic && matchesSearch;
    });
  }, [newslettersList, activeTopic, searchQuery]);

  const handleOpenCreateModal = () => {
    setSelectedNewsletterForEdit(null);
    setIsEditorModalOpen(true);
  };

  const handleOpenEditModal = (item: NewsletterRow) => {
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

    setNewslettersList((prev) => {
      // A rename changes the slug, so matching only the saved slug left the old
      // card behind and added a second one. Remove the row this editor opened.
      const withoutOld = prev.filter(
        (item) => item.slug !== updated.slug && (!previousSlug || item.slug !== previousSlug)
      );
      return [...withoutOld, updated];
    });
    toast.success(`Bulletin "${savedRecord.title}" saved successfully`);
  };

  return (
    <div className="space-y-8">
      {/* Controls: Search and Filter Chips */}
      <div className="civic-panel flex flex-col items-stretch justify-between gap-4 p-4 md:flex-row md:items-center">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-ink-muted-on-dark"
            size={16}
          />
          <input
            type="text"
            placeholder={
              dataPoints['news.search.placeholder'] || 'Search bulletins, topics, or insights...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-border bg-surface-muted py-2.5 pl-10 pr-4 text-xs text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:text-sm dark:border-white/10 dark:text-white"
          />
        </div>

        {/* Topic Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {allTopics.slice(0, 6).map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => setActiveTopic(topic)}
              className={`min-h-10 border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${
                activeTopic === topic
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-surface-muted/60 text-muted-foreground hover:bg-surface-card hover:text-foreground dark:text-ink-muted-on-dark dark:hover:bg-white/5 dark:hover:text-ink-on-dark'
              }`}
            >
              {topic === 'All Topics' ? dataPoints['news.topic.all'] || 'All Topics' : topic}
            </button>
          ))}
        </div>

        {/* In-Page Admin Add Bulletin Trigger */}
        {isAdmin && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 border border-primary bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark"
          >
            <Plus size={15} />
            <DataPoint name="news.admin.add_bulletin" as="span" initialData={dataPoints}>
              Add Bulletin
            </DataPoint>
          </button>
        )}
      </div>

      {/* Bulletins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {newslettersList.length === 0 ? (
          <div className="civic-panel col-span-full p-12 text-center text-muted-foreground dark:text-ink-muted-on-dark">
            {/*
              `news.empty.desc` is seeded with the filter/no-results copy. Using
              it here would make the seeded CMS value override the honest
              archive-empty message, so this branch stays local.
            */}
            <p className="text-sm">
              No chapter bulletins have been published yet. Check back soon for the next archive
              entry.
            </p>
          </div>
        ) : filteredNewsletters.length === 0 ? (
          <div className="civic-panel col-span-full p-12 text-center text-muted-foreground dark:text-ink-muted-on-dark">
            <DataPoint as="span" name="news.empty.desc" initialData={dataPoints}>
              No chapter bulletins match your criteria. Try choosing “All Topics” or searching for
              another civic keyword.
            </DataPoint>
          </div>
        ) : (
          filteredNewsletters.map((newsletter) => (
            <div
              key={newsletter.slug || newsletter.title}
              className="civic-panel flex flex-col justify-between p-6 transition-colors hover:border-primary/40"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary-ink dark:text-accent-gold uppercase tracking-wider">
                    {newsletter.date_label}
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground dark:text-ink-muted-on-dark font-semibold uppercase">
                      <DataPoint name="news.bulletin_tag" as="span" initialData={dataPoints}>
                        Chapter Bulletin
                      </DataPoint>
                    </span>

                    {/* Admin in-page action bar */}
                    {isAdmin && (
                      <div className="ml-1 inline-flex items-center gap-2 border border-border bg-surface-muted px-2 py-0.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(newsletter)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-gold hover:text-white transition-colors cursor-pointer"
                          title="Edit this bulletin"
                        >
                          <PenLine size={11} />
                          <DataPoint name="news.admin.btn_edit" as="span" initialData={dataPoints}>
                            Edit
                          </DataPoint>
                        </button>
                        <span className="text-white/20">|</span>
                        <ConfirmAction
                          label={`Delete bulletin ${newsletter.title}`}
                          message={`Delete bulletin "${newsletter.title}" from archives?`}
                          danger
                          onConfirm={() =>
                            handleDeleteNewsletter(newsletter.slug, newsletter.title)
                          }
                          idleClassName="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                        >
                          <Trash2 size={11} />
                          <DataPoint
                            name="news.admin.btn_delete"
                            as="span"
                            initialData={dataPoints}
                          >
                            Delete
                          </DataPoint>
                        </ConfirmAction>
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="font-display text-2xl font-semibold leading-snug tracking-[-0.02em]">
                  {newsletter.title}
                </h3>
                <p className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed">
                  {newsletter.description}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {newsletter.topics.map((topic) => (
                    <span
                      key={topic}
                      className="border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground dark:text-ink-on-dark"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-border dark:border-white/10 mt-6 flex items-center justify-between">
                <a
                  href="mailto:contact@indivisiblefairoaks.org?subject=Archive%20Request%20-%20Bulletin"
                  className="text-xs font-bold text-primary-ink dark:text-primary-on-dark hover:underline flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xs"
                >
                  <DataPoint name="news.read_bulletin" as="span" initialData={dataPoints}>
                    Request Full Issue
                  </DataPoint>
                  <ArrowRight size={14} aria-hidden="true" />
                </a>
                <span className="text-[11px] text-muted-foreground dark:text-ink-muted-on-dark">
                  PDF &amp; Email Archive
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Admin Bulletin Edit Modal */}
      {isEditorModalOpen && (
        <CivicNewsletterEditorModal
          isOpen={isEditorModalOpen}
          onClose={() => setIsEditorModalOpen(false)}
          newsletter={selectedNewsletterForEdit}
          onSaved={handleNewsletterSaved}
        />
      )}
    </div>
  );
}
