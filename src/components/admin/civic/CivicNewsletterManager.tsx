'use client';

import { Loader2, Newspaper, Pencil, Plus, RefreshCw, Search, Tag, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import {
  type CivicNewsletterRecord,
  deleteCivicNewsletter,
  getCivicNewslettersAdmin,
} from '@/lib/actions/civic';
import { CivicNewsletterEditorModal } from './CivicNewsletterEditorModal';

interface CivicNewsletterManagerProps {
  onRefreshParent?: () => void;
}

export function CivicNewsletterManager({ onRefreshParent }: CivicNewsletterManagerProps) {
  const [newsletters, setNewsletters] = useState<CivicNewsletterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNewsletter, setEditingNewsletter] = useState<CivicNewsletterRecord | null>(null);

  const fetchNewsletters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCivicNewslettersAdmin();
      if (res.success && res.data) {
        setNewsletters(res.data);
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
    fetchNewsletters();
  }, [fetchNewsletters]);

  const handleDelete = async (slug: string) => {
    try {
      const res = await deleteCivicNewsletter(slug);
      if (res.success) {
        toast.success('Bulletin deleted');
        setNewsletters((prev) => prev.filter((n) => n.slug !== slug));
        onRefreshParent?.();
      } else {
        toast.error(res.error || 'Failed to delete bulletin');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error deleting bulletin');
    }
  };

  const filteredNewsletters = newsletters.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.description.toLowerCase().includes(q) ||
      n.topics.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-surface-muted/60 rounded-2xl border border-border">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search newsletters by title or topic..."
              className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-border bg-background text-xs focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={fetchNewsletters}
            disabled={loading}
            title="Refresh newsletters list"
            className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingNewsletter(null);
            setIsEditorOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-light text-white text-xs font-black uppercase tracking-wider transition-all shadow-xs"
        >
          <Plus size={14} />
          <span>New Bulletin</span>
        </button>
      </div>

      {/* Newsletter List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[300px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 size={24} className="animate-spin text-primary" />
            <span className="text-xs font-semibold">Loading newsletters...</span>
          </div>
        ) : filteredNewsletters.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-surface-muted/30 p-8 space-y-2">
            <Newspaper size={28} className="mx-auto text-muted-foreground/60" />
            <p className="text-sm font-bold text-foreground">No newsletters found</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery
                ? 'Try adjusting your search query.'
                : 'Publish your chapter’s first action bulletin or legislative summary.'}
            </p>
          </div>
        ) : (
          filteredNewsletters.map((item) => (
            <div
              key={item.slug}
              className="p-4 rounded-2xl border border-border bg-surface-card hover:border-primary/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs group"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-secondary dark:bg-slate-800 text-primary-on-dark flex items-center justify-center shrink-0 mt-0.5 border border-white/10">
                  <Newspaper size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary-ink dark:text-primary-on-dark text-[10px] font-black uppercase tracking-wider">
                      {item.date_label}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed max-w-xl">
                    {item.description}
                  </p>
                  {item.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.topics.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md"
                        >
                          <Tag size={9} />
                          <span>{t}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditingNewsletter(item);
                    setIsEditorOpen(true);
                  }}
                  title="Edit newsletter"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-bold text-foreground transition-colors"
                >
                  <Pencil size={12} />
                  <span>Edit</span>
                </button>
                <ConfirmAction
                  label={`Delete newsletter ${item.title}`}
                  message={`Delete newsletter "${item.title}"? This cannot be undone.`}
                  danger
                  confirmLabel="Delete"
                  onConfirm={() => handleDelete(item.slug)}
                  idleClassName="p-1.5 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 size={14} />
                </ConfirmAction>
              </div>
            </div>
          ))
        )}
      </div>

      <CivicNewsletterEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        newsletter={editingNewsletter}
        onSaved={() => {
          fetchNewsletters();
          onRefreshParent?.();
        }}
      />
    </div>
  );
}
