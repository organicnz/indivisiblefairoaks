'use client';

import { ArrowRight, PenLine, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { CivicNewsletterEditorModal } from '@/components/admin/civic/CivicNewsletterEditorModal';
import { useEditContext } from '@/components/layout/useEditContext';
import { useVisualEditMode } from '@/components/layout/visual-edit-store';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';
import { type CivicNewsletterRecord, deleteCivicNewsletter } from '@/lib/actions/civic';
import type { NewsletterRow } from '@/lib/queries/civic';

const FALLBACK_NEWSLETTERS: NewsletterRow[] = [
  {
    slug: 'summer-action-bulletin-2026',
    title: 'Indivisible Fair Oaks-Carmichael Summer Action Bulletin',
    date_label: 'July 2026',
    description:
      'Summer organizing priorities: preparing for upcoming elections, choir street demonstrations at Fair Oaks & Manzanita, local food bank drives, and phone-banking schedules.',
    topics: ['Election Defense', 'Choir Actions', 'Food Drive', 'Mobilize Events'],
    sort_order: 10,
  },
  {
    slug: 'mid-year-grassroots-review-2026',
    title: 'Mid-Year Grassroots Review & Legislative Round-up',
    date_label: 'June 2026',
    description:
      'Review of California state legislative priorities, local city council actions, deep canvass voter persuasion results, and upcoming coalition rallies in Citrus Heights.',
    topics: ['California Bills', 'Deep Canvass', 'Sunrise Solidarity', 'Voter Outreach'],
    sort_order: 20,
  },
  {
    slug: 'spring-mobilization-choir-launch-2026',
    title: 'Spring Mobilization & Resistance Choir Launch',
    date_label: 'May 2026',
    description:
      'Announcing the official schedule for the Carmichael Resistance Choir, spring town hall debriefs, and youth voter pre-registration drives across Sacramento County.',
    topics: ['Resistance Choir', 'Youth Pre-Registration', 'Town Halls'],
    sort_order: 30,
  },
  {
    slug: 'defending-democratic-norms-spring-2026',
    title: 'Defending Democratic Norms: Spring Chapter Newsletter',
    date_label: 'April 2026',
    description:
      'National Indivisible strategy updates, local community resistance workshops, and mutual aid efforts for Fair Oaks and Carmichael neighborhood families.',
    topics: ['National Strategy', 'Mutual Aid', 'Community Care'],
    sort_order: 40,
  },
];

export function InteractiveNewslettersList({
  initialNewsletters,
}: {
  initialNewsletters?: NewsletterRow[];
} = {}) {
  const { dataPoints } = useDataPoints('news');
  const { enabled } = useVisualEditMode('/news');
  const { isAdmin } = useEditContext('/news');

  const [newslettersList, setNewslettersList] = useState<NewsletterRow[]>(
    initialNewsletters && initialNewsletters.length > 0 ? initialNewsletters : FALLBACK_NEWSLETTERS
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState('All Topics');
  const [selectedNewsletterForEdit, setSelectedNewsletterForEdit] =
    useState<CivicNewsletterRecord | null>(null);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadNewslettersFromApi() {
      try {
        const res = await fetch('/api/civic/newsletters');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data.newsletters) && data.newsletters.length > 0) {
            setNewslettersList(data.newsletters);
          }
        }
      } catch {
        // Fall back gracefully
      }
    }
    loadNewslettersFromApi();
    return () => {
      cancelled = true;
    };
  }, []);

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
      published_at: null,
    });
    setIsEditorModalOpen(true);
  };

  const handleDeleteNewsletter = async (slug: string, title: string) => {
    try {
      const res = await fetch(`/api/civic/newsletters?slug=${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setNewslettersList((prev) => prev.filter((item) => item.slug !== slug));
        toast.success(`Bulletin "${title}" deleted`);
      } else {
        const fallbackRes = await deleteCivicNewsletter(slug);
        if (fallbackRes.success) {
          setNewslettersList((prev) => prev.filter((item) => item.slug !== slug));
          toast.success(`Bulletin "${title}" deleted`);
        } else {
          toast.error(fallbackRes.error || 'Failed to delete bulletin');
        }
      }
    } catch {
      toast.error('Failed to delete bulletin');
    }
  };

  const handleNewsletterSaved = (savedRecord: CivicNewsletterRecord) => {
    setIsEditorModalOpen(false);
    const updated: NewsletterRow = {
      slug: savedRecord.slug,
      title: savedRecord.title,
      date_label: savedRecord.date_label,
      description: savedRecord.description,
      topics: savedRecord.topics,
      sort_order: savedRecord.sort_order,
    };

    setNewslettersList((prev) => {
      const idx = prev.findIndex((item) => item.slug === updated.slug);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [updated, ...prev];
    });
    toast.success(`Bulletin "${savedRecord.title}" saved successfully`);
  };

  return (
    <div className="space-y-8">
      {/* Controls: Search and Filter Chips */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl bg-surface-card border border-border dark:bg-secondary dark:border-white/10 shadow-xs backdrop-blur-md">
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
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-muted dark:bg-secondary border border-border dark:border-slate-700 text-foreground dark:text-white placeholder:text-muted-foreground text-xs sm:text-sm focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Topic Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {allTopics.slice(0, 6).map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => setActiveTopic(topic)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTopic === topic
                  ? 'bg-primary-bright text-white shadow-md'
                  : 'bg-surface-muted dark:bg-secondary/60 text-muted-foreground dark:text-ink-muted-on-dark hover:text-foreground dark:hover:text-slate-200 hover:bg-surface-card dark:hover:bg-white/5 border border-border dark:border-transparent'
              }`}
            >
              {topic}
            </button>
          ))}
        </div>

        {/* In-Page Admin Add Bulletin Trigger */}
        {enabled && isAdmin && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-gold hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md transition-all shrink-0 cursor-pointer"
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
        {filteredNewsletters.length === 0 ? (
          <div className="col-span-full p-12 text-center rounded-2xl bg-secondary border border-white/10 text-ink-muted-on-dark">
            <DataPoint as="span" name="news.empty.desc" initialData={dataPoints}>
              No chapter bulletins match your criteria. Try choosing &ldquo;All Topics&rdquo; or
              clearing the search bar.
            </DataPoint>
          </div>
        ) : (
          filteredNewsletters.map((newsletter) => (
            <div
              key={newsletter.slug || newsletter.title}
              className="p-6 rounded-2xl bg-surface-card dark:bg-secondary/80 border border-border dark:border-white/10 hover:border-border dark:hover:border-slate-700 transition-all flex flex-col justify-between"
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
                    {enabled && isAdmin && (
                      <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-secondary/90 border border-accent-gold/40 shadow-xs backdrop-blur-md ml-1">
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

                <h3 className="text-lg font-bold text-foreground dark:text-white leading-snug">
                  {newsletter.title}
                </h3>
                <p className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed">
                  {newsletter.description}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {newsletter.topics.map((topic) => (
                    <span
                      key={topic}
                      className="px-2 py-0.5 rounded-md bg-surface-muted dark:bg-white/5 text-[10px] font-semibold text-muted-foreground dark:text-ink-muted-on-dark"
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
