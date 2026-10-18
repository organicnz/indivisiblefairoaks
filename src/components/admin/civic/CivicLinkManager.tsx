'use client';

import { ExternalLink, Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import {
  type CoalitionLinkRecord,
  deleteCoalitionLink,
  getCoalitionLinksAdmin,
} from '@/lib/actions/civic';
import { CivicLinkEditorModal } from './CivicLinkEditorModal';

interface CivicLinkManagerProps {
  onRefreshParent?: () => void;
}

export function CivicLinkManager({ onRefreshParent }: CivicLinkManagerProps) {
  const [links, setLinks] = useState<CoalitionLinkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<CoalitionLinkRecord | null>(null);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCoalitionLinksAdmin();
      if (res.success && res.data) {
        setLinks(res.data);
      } else if (!res.success) {
        toast.error(res.error || 'Failed to load coalition links');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error fetching coalition links');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleDelete = async (slug: string) => {
    try {
      const res = await deleteCoalitionLink(slug);
      if (res.success) {
        toast.success('Link deleted');
        setLinks((prev) => prev.filter((l) => l.slug !== slug));
        onRefreshParent?.();
      } else {
        toast.error(res.error || 'Failed to delete link');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error deleting link');
    }
  };

  const categories = Array.from(new Set(links.map((l) => l.category).filter(Boolean)));

  const filteredLinks = links.filter((l) => {
    const matchesSearch =
      !searchQuery.trim() ||
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || l.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-surface-muted/60 rounded-2xl border border-border">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 min-w-[180px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search links by name, URL, or topic..."
              className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-border bg-background text-xs focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-semibold focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="all">All Categories ({links.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={fetchLinks}
            disabled={loading}
            title="Refresh links"
            className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingLink(null);
            setIsEditorOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-light text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-xs"
        >
          <Plus size={14} />
          <span>New Coalition Link</span>
        </button>
      </div>

      {/* Content list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground space-y-2">
            <Loader2 size={24} className="animate-spin text-primary" />
            <span className="text-xs font-semibold">Loading coalition links...</span>
          </div>
        ) : filteredLinks.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-border text-muted-foreground space-y-3">
            <p className="text-sm font-semibold">No coalition links found</p>
            <button
              type="button"
              onClick={() => {
                setEditingLink(null);
                setIsEditorOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-muted hover:bg-muted text-foreground text-xs font-bold transition-colors"
            >
              <Plus size={13} />
              <span>Add First Link</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredLinks.map((l) => (
              <div
                key={l.slug}
                className="p-4 rounded-xl border border-border bg-surface-card hover:border-primary/40 transition-colors flex flex-col justify-between space-y-3 shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary-ink dark:text-primary-on-dark text-[10px] font-bold uppercase tracking-wider">
                        {l.category}
                      </span>
                      {l.badge && (
                        <span className="px-2 py-0.5 rounded-md bg-accent-gold/20 text-accent text-[10px] font-bold uppercase">
                          {l.badge}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLink(l);
                          setIsEditorOpen(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit link"
                      >
                        <Pencil size={13} />
                      </button>
                      <ConfirmAction
                        label={`Delete link ${l.name}`}
                        message={`Delete "${l.name}" from coalition links?`}
                        danger
                        onConfirm={() => handleDelete(l.slug)}
                        idleClassName="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={13} />
                      </ConfirmAction>
                    </div>
                  </div>

                  <h3 className="font-bold text-foreground text-sm mt-2">{l.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {l.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-primary hover:underline truncate max-w-[260px]"
                  >
                    <span>{l.url.replace(/^https?:\/\//, '')}</span>
                    <ExternalLink size={11} className="shrink-0" />
                  </a>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Order: {l.sort_order}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CivicLinkEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingLink(null);
        }}
        link={editingLink}
        onSaved={(saved) => {
          setLinks((prev) => {
            const idx = prev.findIndex((item) => item.slug === saved.slug);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = saved;
              return updated;
            }
            return [...prev, saved].sort((a, b) => a.sort_order - b.sort_order);
          });
          onRefreshParent?.();
        }}
      />
    </div>
  );
}
