'use client';

import { Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { type CoalitionLinkRecord, saveCoalitionLink } from '@/lib/actions/civic';

interface CivicLinkEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  link: CoalitionLinkRecord | null;
  onSaved: (saved: CoalitionLinkRecord) => void;
}

const COMMON_CATEGORIES = [
  'Movement Partners',
  'Voter Resources',
  'Civic Education',
  'Support',
  'Democracy Defense',
  'Local Alliances',
] as const;

export function CivicLinkEditorModal({
  isOpen,
  onClose,
  link,
  onSaved,
}: CivicLinkEditorModalProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState<string>('Movement Partners');
  const [customCategory, setCustomCategory] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [badge, setBadge] = useState('');
  const [sortOrder, setSortOrder] = useState(10);

  useEffect(() => {
    if (link) {
      setName(link.name || '');
      setSlug(link.slug || '');
      const isCommon = COMMON_CATEGORIES.includes(
        link.category as (typeof COMMON_CATEGORIES)[number]
      );
      if (isCommon) {
        setCategory(link.category);
        setCustomCategory('');
      } else {
        setCategory('custom');
        setCustomCategory(link.category || '');
      }
      setUrl(link.url || '');
      setDescription(link.description || '');
      setBadge(link.badge || '');
      setSortOrder(link.sort_order ?? 10);
    } else {
      setName('');
      setSlug('');
      setCategory('Movement Partners');
      setCustomCategory('');
      setUrl('');
      setDescription('');
      setBadge('');
      setSortOrder(10);
    }
  }, [link]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Link name is required');
      return;
    }
    if (!url.trim()) {
      toast.error('Valid URL is required');
      return;
    }

    const resolvedCategory = category === 'custom' ? customCategory.trim() : category;
    if (!resolvedCategory) {
      toast.error('Category is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        slug: slug.trim() || undefined,
        name: name.trim(),
        category: resolvedCategory,
        url: url.trim(),
        description: description.trim(),
        badge: badge.trim() || null,
        sort_order: sortOrder,
      };

      let savedRecord: CoalitionLinkRecord | null = null;
      try {
        const apiRes = await fetch('/api/coalition-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (apiRes.ok) {
          const json = await apiRes.json();
          if (json.success && json.link) {
            savedRecord = json.link;
          }
        }
      } catch {
        // Fall back to server action
      }

      if (!savedRecord) {
        const actionRes = await saveCoalitionLink(payload);
        if (!actionRes.success) {
          toast.error(actionRes.error || 'Failed to save link');
          setSaving(false);
          return;
        }
        savedRecord = actionRes.data;
      }

      if (savedRecord) {
        toast.success(`Link "${savedRecord.name}" saved`);
        onSaved(savedRecord);
        onClose();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error saving coalition link');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-surface-card border border-border text-foreground shadow-2xl p-6 sm:p-8 rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b border-border">
          <div>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground">
              {link ? 'Edit Coalition Link' : 'Add Coalition Link'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Publish vetted civic resources, voting guides, and democracy partner websites.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={18} />
          </button>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="link-name"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5"
              >
                Link Name *
              </label>
              <input
                id="link-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Indivisible National"
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="link-slug"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5"
              >
                URL Slug (Optional)
              </label>
              <input
                id="link-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. indivisible-national"
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="link-url"
              className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5"
            >
              Website URL *
            </label>
            <input
              id="link-url"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.org"
              className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="link-category"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5"
              >
                Category *
              </label>
              <select
                id="link-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-sm font-semibold focus:ring-2 focus:ring-primary focus:outline-none"
              >
                {COMMON_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="custom">+ Custom Category</option>
              </select>
            </div>

            {category === 'custom' && (
              <div>
                <label
                  htmlFor="link-custom-category"
                  className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5"
                >
                  Custom Category Name *
                </label>
                <input
                  id="link-custom-category"
                  type="text"
                  required
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="e.g. Sacramento Grassroots"
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="link-badge"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5"
              >
                Badge / Tag (Optional)
              </label>
              <input
                id="link-badge"
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                placeholder="e.g. National Hub, Official SOS"
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="link-description"
              className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5"
            >
              Description *
            </label>
            <textarea
              id="link-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of why this civic resource is valuable to community organizers..."
              className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="link-sort"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5"
              >
                Sort Order (Ascending)
              </label>
              <input
                id="link-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-foreground text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary hover:bg-primary-light text-white text-xs font-black uppercase tracking-wider transition-colors shadow-md disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{link ? 'Update Link' : 'Create Link'}</span>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
