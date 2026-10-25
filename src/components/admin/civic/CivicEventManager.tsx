'use client';

import {
  Calendar,
  ExternalLink,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { type CivicEventRecord, deleteCivicEvent, getCivicEventsAdmin } from '@/lib/actions/civic';
import { CivicEventEditorModal } from './CivicEventEditorModal';

interface CivicEventManagerProps {
  onRefreshParent?: () => void;
}

export function CivicEventManager({ onRefreshParent }: CivicEventManagerProps) {
  const [events, setEvents] = useState<CivicEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CivicEventRecord | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCivicEventsAdmin();
      if (res.success && res.data) {
        setEvents(res.data);
      } else if (!res.success) {
        toast.error(res.error || 'Failed to load events');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error fetching events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleDelete = async (slug: string) => {
    try {
      const res = await deleteCivicEvent(slug);
      if (res.success) {
        toast.success('Event deleted');
        setEvents((prev) => prev.filter((e) => e.slug !== slug));
        onRefreshParent?.();
      } else {
        toast.error(res.error || 'Failed to delete event');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error deleting event');
    }
  };

  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      !searchQuery.trim() ||
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.location_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || e.category === selectedCategory;
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
              placeholder="Search events by title or venue..."
              className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-border bg-background text-xs focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-semibold focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="Meetings">Meetings</option>
            <option value="Resistance Choir">Resistance Choir</option>
            <option value="Voter Mobilization">Voter Mobilization</option>
            <option value="Rallies & Street Action">Rallies &amp; Street Action</option>
          </select>

          <button
            type="button"
            onClick={fetchEvents}
            disabled={loading}
            title="Refresh events list"
            aria-label="Refresh events list"
            className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingEvent(null);
            setIsEditorOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-light text-white text-xs font-black uppercase tracking-wider transition-all shadow-xs"
        >
          <Plus size={14} />
          <span>New Event</span>
        </button>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[300px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 size={24} className="animate-spin text-primary" />
            <span className="text-xs font-semibold">Loading events...</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-surface-muted/30 p-8 space-y-2">
            <Calendar size={28} className="mx-auto text-muted-foreground/60" />
            <p className="text-sm font-bold text-foreground">No events found</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery || selectedCategory !== 'all'
                ? 'Try adjusting your search query or category filter.'
                : 'Get started by creating your chapter’s first upcoming action or community meeting.'}
            </p>
          </div>
        ) : (
          filteredEvents.map((evt) => (
            <div
              key={evt.slug}
              className="p-4 rounded-2xl border border-border bg-surface-card hover:border-primary/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs group"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-secondary dark:bg-slate-800 text-accent-gold flex items-center justify-center shrink-0 mt-0.5 border border-white/10">
                  <Calendar size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="px-2 py-0.5 rounded-full bg-accent-gold/15 border border-accent-gold/40 text-ink-strong dark:text-accent-gold text-[10px] font-black uppercase tracking-wider">
                      {evt.category}
                    </span>
                    {evt.highlight && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-500">
                        <Star size={11} fill="currentColor" /> Highlighted
                      </span>
                    )}
                    <span className="text-xs font-semibold text-muted-foreground">
                      {evt.date_label} • {evt.time_label}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {evt.title}
                  </h4>
                  {evt.location_name && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin size={12} className="text-accent" />
                      <span>{evt.location_name}</span>
                      {evt.address && <span className="opacity-75">({evt.address})</span>}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                {evt.rsvp_url && (
                  <a
                    href={evt.rsvp_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View RSVP Page"
                    aria-label={`View RSVP page for ${evt.title}`}
                    className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingEvent(evt);
                    setIsEditorOpen(true);
                  }}
                  title="Edit event"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-bold text-foreground transition-colors"
                >
                  <Pencil size={12} />
                  <span>Edit</span>
                </button>
                <ConfirmAction
                  label={`Delete event ${evt.title}`}
                  message={`Delete event "${evt.title}"? This cannot be undone.`}
                  danger
                  confirmLabel="Delete"
                  onConfirm={() => handleDelete(evt.slug)}
                  idleClassName="p-1.5 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 size={14} />
                </ConfirmAction>
              </div>
            </div>
          ))
        )}
      </div>

      <CivicEventEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        event={editingEvent}
        onSaved={() => {
          fetchEvents();
          onRefreshParent?.();
        }}
      />
    </div>
  );
}
