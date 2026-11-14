'use client';

import { ExternalLink, Layers, PenLine, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { CivicLinkEditorModal } from '@/components/admin/civic/CivicLinkEditorModal';
import { useEditContext } from '@/components/layout/useEditContext';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';
import { type CoalitionLinkRecord, deleteCoalitionLink } from '@/lib/actions/civic';

export interface LinkItem {
  slug?: string;
  name: string;
  category: string;
  url: string;
  description: string;
  badge?: string;
  sort_order?: number;
}

export function InteractiveLinksDirectory({
  initialLinks,
  initialData,
}: {
  initialLinks: LinkItem[];
  initialData?: Record<string, string>;
}) {
  const { dataPoints } = useDataPoints('links', initialData);
  const { isAdmin } = useEditContext('/links');

  const [linksList, setLinksList] = useState<LinkItem[]>(initialLinks);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [selectedLinkForEdit, setSelectedLinkForEdit] = useState<CoalitionLinkRecord | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of linksList) {
      if (item.category) set.add(item.category);
    }
    return ['All', ...Array.from(set)];
  }, [linksList]);

  const filteredLinks = useMemo(() => {
    return linksList.filter((item) => {
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [linksList, activeCategory, searchQuery]);

  // Group filtered links by category for display
  const groupedLinks = useMemo(() => {
    const groups: Record<string, LinkItem[]> = {};
    for (const item of filteredLinks) {
      const cat = item.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [filteredLinks]);

  const handleOpenCreateModal = () => {
    setSelectedLinkForEdit(null);
    setIsEditorModalOpen(true);
  };

  const handleOpenEditModal = (item: LinkItem) => {
    setSelectedLinkForEdit({
      slug: item.slug || item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: item.name,
      category: item.category,
      url: item.url,
      description: item.description,
      badge: item.badge || null,
      sort_order: item.sort_order ?? 10,
    });
    setIsEditorModalOpen(true);
  };

  const handleDeleteLink = async (slug: string, name: string) => {
    try {
      let success = false;
      try {
        const res = await fetch(`/api/coalition-links?slug=${encodeURIComponent(slug)}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          success = true;
        }
      } catch {
        // Fall back to server action
      }

      if (!success) {
        const actionRes = await deleteCoalitionLink(slug);
        if (!actionRes.success) {
          toast.error(actionRes.error || 'Failed to delete link');
          return;
        }
        success = true;
      }

      if (success) {
        setLinksList((prev) => prev.filter((l) => (l.slug ?? l.name) !== slug));
        toast.success(`Link "${name}" deleted`);
      }
    } catch {
      toast.error('Failed to delete coalition link');
    }
  };

  const handleLinkSaved = (saved: CoalitionLinkRecord) => {
    setIsEditorModalOpen(false);
    const updated: LinkItem = {
      slug: saved.slug,
      name: saved.name,
      category: saved.category,
      url: saved.url,
      description: saved.description,
      badge: saved.badge ?? undefined,
      sort_order: saved.sort_order,
    };

    setLinksList((prev) => {
      const idx = prev.findIndex((l) => l.slug === updated.slug || l.name === updated.name);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [updated, ...prev];
    });
  };

  const showAdminControls = isAdmin;

  return (
    <div className="space-y-10">
      {/* Search, Filter & Admin Toolbar */}
      <div className="flex flex-col items-stretch justify-between gap-4 border-y border-border bg-surface-card p-4 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-ink-muted-on-dark"
            size={16}
          />
          <input
            type="text"
            placeholder="Search resources, partners, or voting guides..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-border bg-surface-muted py-2.5 pl-10 pr-4 text-xs text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none sm:text-sm"
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`min-h-9 cursor-pointer border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors ${
                activeCategory === cat
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* In-Page Admin Add Link Trigger */}
        {showAdminControls && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 border border-accent-gold bg-accent-gold px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-strong transition-colors hover:brightness-95"
          >
            <Plus size={15} />
            <span>Add Link</span>
          </button>
        )}
      </div>

      {/* Links Grouped by Category */}
      {Object.keys(groupedLinks).length === 0 ? (
        <div className="border-y border-border bg-surface-card p-12 text-center text-muted-foreground">
          <p className="text-sm font-semibold">
            No resources found matching your search. Try adjusting the search query or selecting
            &ldquo;All&rdquo;.
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {Object.entries(groupedLinks).map(([category, items]) => (
            <div key={category} className="space-y-4">
              <h2 className="flex items-center gap-2.5 font-display text-2xl font-semibold tracking-[-0.03em]">
                <Layers className="text-accent-gold" size={20} />
                <span>{category}</span>
                <span className="text-xs font-mono font-normal text-muted-foreground dark:text-ink-muted-on-dark">
                  ({items.length})
                </span>
              </h2>

              <div className="border-t border-foreground/25">
                {items.map((item) => {
                  const itemSlug = item.slug || item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                  return (
                    <div
                      key={itemSlug}
                      className="group relative flex flex-col justify-between gap-4 border-b border-border py-5 transition-colors hover:text-primary-ink"
                    >
                      <div>
                        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                          <h3 className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground transition-colors group-hover:text-primary-ink">
                            <DataPoint
                              as="span"
                              name={`link.${itemSlug}.name`}
                              initialData={dataPoints}
                            >
                              {item.name}
                            </DataPoint>
                          </h3>

                          <div className="flex flex-wrap items-center gap-2">
                            {item.badge && (
                              <span className="civic-stamp text-[9px]">
                                <DataPoint
                                  as="span"
                                  name={`link.${itemSlug}.badge`}
                                  initialData={dataPoints}
                                >
                                  {item.badge}
                                </DataPoint>
                              </span>
                            )}

                            {/* Admin in-page edit & delete */}
                            {showAdminControls && (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/90 border border-accent-gold/40 shadow-xs backdrop-blur-md">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(item)}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-gold hover:text-white transition-colors cursor-pointer"
                                  title="Edit this link"
                                >
                                  <PenLine size={11} />
                                  <span>Edit</span>
                                </button>
                                <span className="text-white/20">|</span>
                                <ConfirmAction
                                  label={`Delete link ${item.name}`}
                                  message={`Delete "${item.name}" from coalition links?`}
                                  danger
                                  onConfirm={() => handleDeleteLink(itemSlug, item.name)}
                                  idleClassName="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                                >
                                  <Trash2 size={11} />
                                  <span>Delete</span>
                                </ConfirmAction>
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground dark:text-ink-muted-on-dark leading-relaxed">
                          <DataPoint
                            as="span"
                            name={`link.${itemSlug}.desc`}
                            initialData={dataPoints}
                          >
                            {item.description}
                          </DataPoint>
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-w-0 max-w-full flex-1 items-center gap-1 overflow-hidden font-mono text-[11px] text-primary-ink hover:underline sm:max-w-[240px]"
                        >
                          <span className="truncate">{item.url.replace(/^https?:\/\//, '')}</span>
                        </a>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Visit ${item.name}`}
                          className="p-1 rounded-md hover:bg-muted text-muted-foreground dark:text-ink-muted-on-dark group-hover:text-accent dark:group-hover:text-accent-gold transition-colors shrink-0"
                        >
                          <ExternalLink size={14} aria-hidden="true" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link Editor Modal */}
      <CivicLinkEditorModal
        isOpen={isEditorModalOpen}
        onClose={() => {
          setIsEditorModalOpen(false);
          setSelectedLinkForEdit(null);
        }}
        link={selectedLinkForEdit}
        onSaved={handleLinkSaved}
      />
    </div>
  );
}
