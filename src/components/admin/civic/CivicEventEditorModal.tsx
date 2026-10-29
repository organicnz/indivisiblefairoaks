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
import { type CivicEventRecord, saveCivicEvent } from '@/lib/actions/civic';
// Issue #149: both directions of the timestamp round-trip are zone-explicit.
// Writing: a `datetime-local` value is Pacific wall time, not the organizer's
// device zone. Reading: the editor sees the chapter's clock, not UTC.
import { instantToPacificInput, pacificWallToInstant } from '@/lib/calendar-time';

interface CivicEventEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CivicEventRecord | null;
  onSaved: (saved: CivicEventRecord) => void;
}

const CATEGORIES = [
  'Meetings',
  'Resistance Choir',
  'Voter Mobilization',
  'Rallies & Street Action',
] as const;

export function CivicEventEditorModal({
  isOpen,
  onClose,
  event,
  onSaved,
}: CivicEventEditorModalProps) {
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Meetings');
  const [dateLabel, setDateLabel] = useState('');
  const [timeLabel, setTimeLabel] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [locationName, setLocationName] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [rsvpUrl, setRsvpUrl] = useState('');
  const [highlight, setHighlight] = useState(false);
  const [sortOrder, setSortOrder] = useState(10);

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setSlug(event.slug || '');
      setCategory(event.category || 'Meetings');
      setDateLabel(event.date_label || '');
      setTimeLabel(event.time_label || '');
      // Pacific wall rendering: previously this sliced the stored instant
      // (`2026-11-11T02:30:00+00:00` → `2026-11-11T02:30`), which showed an
      // organizer on a Pacific laptop the UTC clock and then saved their
      // re-submission back wrongly via the device-zone write below.
      setStartsAt(instantToPacificInput(event.starts_at));
      setEndsAt(instantToPacificInput(event.ends_at));
      setLocationName(event.location_name || '');
      setAddress(event.address || '');
      setDescription(event.description || '');
      setRsvpUrl(event.rsvp_url || '');
      setHighlight(Boolean(event.highlight));
      setSortOrder(event.sort_order ?? 10);
    } else {
      setTitle('');
      setSlug('');
      setCategory('Meetings');
      setDateLabel('');
      setTimeLabel('');
      setStartsAt('');
      setEndsAt('');
      setLocationName('');
      setAddress('');
      setDescription('');
      setRsvpUrl('');
      setHighlight(false);
      setSortOrder(10);
    }
  }, [event]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Event title is required');
      return;
    }
    if (!dateLabel.trim()) {
      toast.error('Date label is required (e.g. Saturday, Oct 24, 2026)');
      return;
    }
    if (!timeLabel.trim()) {
      toast.error('Time label is required (e.g. 10:00 AM – 1:00 PM)');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        slug: slug.trim() || undefined,
        title: title.trim(),
        category,
        date_label: dateLabel.trim(),
        time_label: timeLabel.trim(),
        // `pacificWallToInstant` reads the input as Pacific wall time on every
        // device; `new Date(startsAt)` read it in the device's zone and let a
        // non-Pacific organizer silently corrupt the stored instant.
        starts_at: pacificWallToInstant(startsAt) || null,
        ends_at: pacificWallToInstant(endsAt) || null,
        location_name: locationName.trim(),
        address: address.trim(),
        description: description.trim(),
        rsvp_url: rsvpUrl.trim(),
        highlight,
        sort_order: sortOrder,
      };

      let savedRecord: CivicEventRecord | null = null;
      try {
        const apiRes = await fetch('/api/civic/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (apiRes.ok) {
          const apiJson = await apiRes.json();
          if (apiJson.success && apiJson.event) {
            savedRecord = apiJson.event;
          }
        }
      } catch {
        // Fall back gracefully to direct action
      }

      if (!savedRecord) {
        const res = await saveCivicEvent(payload);
        if (!res.success) {
          toast.error(res.error || 'Failed to save event');
          return;
        }
        savedRecord = res.data ?? null;
      }

      toast.success(event ? 'Event updated successfully' : 'New event created');
      if (savedRecord) onSaved(savedRecord);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error saving event');
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
              {event ? 'Edit Event' : 'Create Civic Event'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Configure event details, date labels, venue information, and RSVP links.
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="civic-event-title"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
              >
                Event Title *
              </label>
              <input
                id="civic-event-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Monthly Chapter Gathering & Food Drive"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium"
              />
            </div>

            <div>
              <label
                htmlFor="civic-event-slug"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
              >
                Slug (Optional identifier)
              </label>
              <input
                id="civic-event-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto-generated-from-title"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none font-mono text-xs transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="civic-event-category"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
              >
                Category *
              </label>
              <select
                id="civic-event-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none font-medium transition-all"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="civic-event-date-label"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
              >
                Display Date *
              </label>
              <input
                id="civic-event-date-label"
                type="text"
                value={dateLabel}
                onChange={(e) => setDateLabel(e.target.value)}
                placeholder="e.g. Tuesday, October 20, 2026"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none font-medium transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="civic-event-time-label"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
              >
                Display Time *
              </label>
              <input
                id="civic-event-time-label"
                type="text"
                value={timeLabel}
                onChange={(e) => setTimeLabel(e.target.value)}
                placeholder="e.g. 6:30 PM – 8:00 PM"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none font-medium transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="civic-event-starts-at"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
              >
                Start Time (Calendar sync · Pacific)
              </label>
              <input
                id="civic-event-starts-at"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none font-medium text-xs transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="civic-event-ends-at"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
              >
                End Time (Calendar sync · Pacific)
              </label>
              <input
                id="civic-event-ends-at"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none font-medium text-xs transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="civic-event-location"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
              >
                Location Name
              </label>
              <input
                id="civic-event-location"
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g. St. Michael's Episcopal Church"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none font-medium transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="civic-event-address"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
              >
                Physical Address
              </label>
              <input
                id="civic-event-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 2140 Mission Avenue, Carmichael, CA"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none font-medium transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="civic-event-rsvp"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
              >
                RSVP / Registration URL
              </label>
              <input
                id="civic-event-rsvp"
                type="url"
                value={rsvpUrl}
                onChange={(e) => setRsvpUrl(e.target.value)}
                placeholder="https://www.mobilize.us/indivisible/event/..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none font-medium transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="civic-event-description"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
              >
                Description & Agenda
              </label>
              <textarea
                id="civic-event-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Outline the meeting agenda, organizing goals, what to bring, etc."
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none font-medium transition-all resize-y"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                id="civic-event-highlight"
                type="checkbox"
                checked={highlight}
                onChange={(e) => setHighlight(e.target.checked)}
                className="size-4 rounded border-border text-primary focus:ring-primary accent-primary"
              />
              <label
                htmlFor="civic-event-highlight"
                className="text-xs font-bold text-foreground cursor-pointer"
              >
                Highlight this action on Homepage & Calendar banner
              </label>
            </div>

            <div>
              <label
                htmlFor="civic-event-sort"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
              >
                Sort Order (Ascending)
              </label>
              <input
                id="civic-event-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                className="w-24 px-3.5 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none font-mono text-xs"
              />
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
              <span>{saving ? 'Saving...' : event ? 'Update Event' : 'Create Event'}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
