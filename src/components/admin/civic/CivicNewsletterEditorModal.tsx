'use client';

import { Loader2, Plus, Tag, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { type CivicNewsletterRecord, saveCivicNewsletter } from '@/lib/actions/civic';

interface CivicNewsletterEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  newsletter: CivicNewsletterRecord | null;
  onSaved: (saved: CivicNewsletterRecord) => void;
}

export function CivicNewsletterEditorModal({
  isOpen,
  onClose,
  newsletter,
  onSaved,
}: CivicNewsletterEditorModalProps) {
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [dateLabel, setDateLabel] = useState('');
  const [description, setDescription] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [sortOrder, setSortOrder] = useState(10);
  const [publishedAt, setPublishedAt] = useState('');

  useEffect(() => {
    if (newsletter) {
      setTitle(newsletter.title || '');
      setSlug(newsletter.slug || '');
      setDateLabel(newsletter.date_label || '');
      setDescription(newsletter.description || '');
      setTopics(Array.isArray(newsletter.topics) ? newsletter.topics : []);
      setSortOrder(newsletter.sort_order ?? 10);
      setPublishedAt(newsletter.published_at ? newsletter.published_at.slice(0, 16) : '');
    } else {
      setTitle('');
      setSlug('');
      setDateLabel('');
      setDescription('');
      setTopics([]);
      setSortOrder(10);
      setPublishedAt(new Date().toISOString().slice(0, 16));
    }
  }, [newsletter]);

  const handleAddTopic = () => {
    const val = topicInput.trim();
    if (val && !topics.includes(val)) {
      setTopics([...topics, val]);
      setTopicInput('');
    }
  };

  const handleRemoveTopic = (t: string) => {
    setTopics(topics.filter((item) => item !== t));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Newsletter title is required');
      return;
    }
    if (!dateLabel.trim()) {
      toast.error('Date label is required (e.g. July 2026)');
      return;
    }

    setSaving(true);
    try {
      const res = await saveCivicNewsletter({
        slug: slug.trim() || undefined,
        title: title.trim(),
        date_label: dateLabel.trim(),
        description: description.trim(),
        topics,
        sort_order: sortOrder,
        published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
      });

      if (!res.success) {
        toast.error(res.error || 'Failed to save newsletter');
        return;
      }

      toast.success(newsletter ? 'Newsletter updated' : 'New bulletin created');
      if (res.data) onSaved(res.data);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error saving newsletter');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] bg-surface-card text-foreground p-0 overflow-hidden flex flex-col rounded-3xl border border-border shadow-float">
        <DialogHeader className="p-5 border-b border-border bg-surface-muted/50 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">
              {newsletter ? 'Edit Newsletter / Bulletin' : 'Create Newsletter Post'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Publish organizing recaps, community bulletins, and legislative alerts.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4 flex-1 text-sm">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="civic-news-title"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
              >
                Bulletin Title *
              </label>
              <input
                id="civic-news-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Summer Action Bulletin & Town Hall Recap"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none font-medium transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="civic-news-slug"
                  className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
                >
                  Slug (Optional identifier)
                </label>
                <input
                  id="civic-news-slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="auto-generated-from-title"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none font-mono text-xs transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="civic-news-date-label"
                  className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
                >
                  Issue / Date Label *
                </label>
                <input
                  id="civic-news-date-label"
                  type="text"
                  value={dateLabel}
                  onChange={(e) => setDateLabel(e.target.value)}
                  placeholder="e.g. July 2026 or Fall 2026"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none font-medium transition-all"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="civic-news-description"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
              >
                Summary / Overview *
              </label>
              <textarea
                id="civic-news-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Summarize key organizing priorities, street demonstrations, local election campaigns, etc."
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none font-medium transition-all resize-y leading-relaxed"
              />
            </div>

            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Key Topics & Campaign Tags
              </span>
              <div className="flex items-center gap-2 mb-2">
                <input
                  id="civic-news-topic-input"
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTopic();
                    }
                  }}
                  placeholder="e.g. Election Defense, Choir Actions, Food Drive..."
                  className="flex-1 px-3.5 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none text-xs font-medium"
                />
                <button
                  type="button"
                  onClick={handleAddTopic}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-white font-bold text-xs transition-colors"
                >
                  <Plus size={14} />
                  <span>Add Tag</span>
                </button>
              </div>

              {topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {topics.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent-gold/15 border border-accent-gold/40 text-secondary dark:text-accent-gold text-xs font-bold"
                    >
                      <Tag size={11} />
                      <span>{t}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTopic(t)}
                        className="p-0.5 hover:bg-black/10 dark:hover:bg-white/20 rounded-full"
                        aria-label={`Remove topic ${t}`}
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label
                  htmlFor="civic-news-published-at"
                  className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
                >
                  Publication Timestamp
                </label>
                <input
                  id="civic-news-published-at"
                  type="datetime-local"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none font-medium text-xs transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="civic-news-sort"
                  className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
                >
                  Sort Order
                </label>
                <input
                  id="civic-news-sort"
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                  className="w-24 px-3.5 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-bold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary hover:bg-primary-light text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              <span>
                {saving ? 'Saving...' : newsletter ? 'Update Bulletin' : 'Create Bulletin'}
              </span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
