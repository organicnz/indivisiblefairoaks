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

export function InteractiveLinksDirectory({ initialLinks }: { initialLinks: LinkItem[] }) {
  const { dataPoints } = useDataPoints('links');
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
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl bg-surface-card border border-border shadow-sm">
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
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-muted border border-border dark:border-slate-700 text-foreground dark:text-white placeholder:text-muted-foreground text-xs sm:text-sm focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-primary-bright text-white shadow-md'
                  : 'bg-surface-muted/60 text-muted-foreground dark:text-ink-muted-on-dark hover:text-foreground dark:hover:text-slate-200 hover:bg-surface-card dark:hover:bg-white/5 border border-border dark:border-transparent'
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
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-gold hover:bg-accent-gold text-slate-950 font-black text-xs uppercase tracking-wider shadow-md transition-all shrink-0 cursor-pointer"
          >
            <Plus size={15} />
            <span>Add Link</span>
          </button>
        )}
      </div>

      {/* Links Grouped by Category */}
      {Object.keys(groupedLinks).length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-surface-card border border-border text-muted-foreground dark:text-ink-muted-on-dark">
          <p className="text-sm font-semibold">
            No resources found matching your search. Try adjusting the search query or selecting
            &ldquo;All&rdquo;.
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {Object.entries(groupedLinks).map(([category, items]) => (
            <div key={category} className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-black text-foreground dark:text-white tracking-tight flex items-center gap-2.5">
                <Layers className="text-accent-gold" size={20} />
                <span>{category}</span>
                <span className="text-xs font-mono font-normal text-muted-foreground dark:text-ink-muted-on-dark">
                  ({items.length})
                </span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item) => {
                  const itemSlug = item.slug || item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                  return (
                    <div
                      key={itemSlug}
                      data-data-point={`link.${itemSlug}`}
                      className="p-5 rounded-2xl bg-surface-card border border-border hover:border-primary-bright/50 transition-all group flex flex-col justify-between shadow-xs relative"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="font-bold text-foreground dark:text-white text-base group-hover:text-primary-ink dark:group-hover:text-primary-on-dark transition-colors">
                            <DataPoint
                              as="span"
                              name={`link.${itemSlug}.name`}
                              initialData={dataPoints}
                            >
                              {item.name}
                            </DataPoint>
                          </h3>

                          <div className="flex items-center gap-2">
                            {item.badge && (
                              <span className="px-2 py-0.5 rounded-full bg-accent-gold/20 text-primary-ink dark:text-accent-gold text-[10px] font-bold uppercase shrink-0">
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

                      <div className="pt-4 mt-4 border-t border-border dark:border-white/10 flex items-center justify-between text-xs text-muted-foreground dark:text-ink-muted-on-dark">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-primary-ink dark:text-primary-on-dark-muted/90 font-mono hover:underline truncate max-w-[240px] inline-flex items-center gap-1"
                        >
                          <span>{item.url.replace(/^https?:\/\//, '')}</span>
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
