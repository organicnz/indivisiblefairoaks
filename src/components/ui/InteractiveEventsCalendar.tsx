'use client';

import {
  CalendarPlus,
  Clock,
  Download,
  ExternalLink,
  MapPin,
  Music,
  PenLine,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { CivicEventEditorModal } from '@/components/admin/civic/CivicEventEditorModal';
import { useEditContext } from '@/components/layout/useEditContext';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';
import { type CivicEventRecord, deleteCivicEvent } from '@/lib/actions/civic';
import { buildGoogleCalendarUrl } from '@/lib/civic-events';

export interface CivicEvent {
  id: string;
  title: string;
  category: 'Meetings' | 'Resistance Choir' | 'Voter Mobilization' | 'Rallies & Street Action';
  dateLabel: string;
  timeLabel: string;
  isoDateStart: string;
  isoDateEnd: string;
  locationName: string;
  address: string;
  description: string;
  rsvpUrl: string;
  highlight?: boolean;
}

const EVENTS: CivicEvent[] = [
  {
    id: 'monthly-gathering-nov',
    title: 'Monthly Chapter Gathering & Food Bank Drive',
    category: 'Meetings',
    dateLabel: 'Tuesday, November 10, 2026',
    timeLabel: '6:30 PM – 8:00 PM',
    isoDateStart: '20261110T183000',
    isoDateEnd: '20261110T200000',
    locationName: "St. Michael's Episcopal Church",
    address: '2140 Mission Avenue, Carmichael, CA 95608',
    description:
      'Our primary monthly community gathering. Agenda includes post-election debrief and organizing strategies, federal and local updates, and a food drive for our neighborhood pantry. Please bring canned or non-perishable goods.',
    rsvpUrl: 'https://www.mobilize.us/indivisible/',
    highlight: true,
  },
  {
    id: 'no-kings-4',
    title: 'No Kings 4: Peaceful Protest & Stand-Out for Constitutional Democracy',
    category: 'Rallies & Street Action',
    dateLabel: 'Saturday, October 17, 2026',
    timeLabel: '10:00 AM – 12:00 PM',
    isoDateStart: '20261017T100000',
    isoDateEnd: '20261017T120000',
    locationName: 'Fair Oaks Public Square & Intersection',
    address: 'Fair Oaks Blvd & Sunrise Blvd, Fair Oaks, CA',
    description:
      'Stand with Indivisible Fair Oaks-Carmichael in defense of constitutional democracy, equal justice under law, and judicial accountability. Bring your homemade signs, American flags, and comfortable shoes. Strictly nonviolent.',
    rsvpUrl: 'https://www.mobilize.us/indivisible/',
    highlight: true,
  },
  {
    id: 'singing-protest-ongoing',
    title: 'Carmichael Resistance Choir: Street Corner Singing Protest',
    category: 'Resistance Choir',
    dateLabel: 'Ongoing Every Saturday Afternoon',
    timeLabel: '3:00 PM – 4:30 PM',
    isoDateStart: '20261017T150000',
    isoDateEnd: '20261017T163000',
    locationName: 'Carmichael Corner Demonstration',
    address: 'Corner of Fair Oaks Blvd & Manzanita Ave, Carmichael, CA',
    description:
      'Ongoing street corner singing demonstration to afternoon traffic and community patrons. We sing protest anthems, chants of courage, and songs of resistance. Bring your signs, lawn chairs, and voices to stand up for democracy!',
    rsvpUrl: 'https://www.mobilize.us/indivisible/event/1011420/',
    highlight: false,
  },
  {
    id: 'choir-rehearsal-biweekly',
    title: 'Carmichael Resistance Choir Bi-Weekly Rehearsal',
    category: 'Resistance Choir',
    dateLabel: 'Every Other Wednesday',
    timeLabel: '6:30 PM – 8:00 PM',
    isoDateStart: '20261021T183000',
    isoDateEnd: '20261021T200000',
    locationName: 'Community Center / Church Hall',
    address: 'Carmichael, CA (Address provided upon registration)',
    description:
      'Learn 4-part harmonies, freedom anthems, and chants of resistance. No auditions or singing experience required — all voices are warmly welcomed!',
    rsvpUrl: 'mailto:contact@indivisiblefairoaks.org?subject=Join%20Resistance%20Choir',
  },
];

const CATEGORIES = [
  'All Actions',
  'Meetings',
  'Resistance Choir',
  'Voter Mobilization',
  'Rallies & Street Action',
] as const;

export function InteractiveEventsCalendar({
  initialEvents,
}: {
  initialEvents?: CivicEvent[];
} = {}) {
  const { dataPoints } = useDataPoints('events');
  const { isAdmin } = useEditContext('/events');
  const [activeCategory, setActiveCategory] = useState<string>('All Actions');
  const [searchQuery, setSearchQuery] = useState('');
  const [eventsList, setEventsList] = useState<CivicEvent[]>(
    initialEvents && initialEvents.length > 0 ? initialEvents : EVENTS
  );
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<CivicEventRecord | null>(null);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadEventsFromApi() {
      try {
        const res = await fetch('/api/civic/events');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data.events) && data.events.length > 0) {
            setEventsList(data.events);
          }
        }
      } catch {
        // Fall back gracefully to existing state
      }
    }
    loadEventsFromApi();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredEvents = eventsList.filter((event) => {
    const matchesCategory = activeCategory === 'All Actions' || event.category === activeCategory;
    const matchesSearch =
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.locationName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleOpenCreateModal = () => {
    setSelectedEventForEdit(null);
    setIsEditorModalOpen(true);
  };

  const handleOpenEditModal = (event: CivicEvent) => {
    setSelectedEventForEdit({
      slug: event.id,
      title: event.title,
      category: event.category,
      date_label: event.dateLabel,
      time_label: event.timeLabel,
      starts_at: null,
      ends_at: null,
      location_name: event.locationName,
      address: event.address,
      description: event.description,
      rsvp_url: event.rsvpUrl,
      highlight: Boolean(event.highlight),
      sort_order: 10,
    });
    setIsEditorModalOpen(true);
  };

  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    try {
      const res = await fetch(`/api/civic/events?slug=${encodeURIComponent(eventId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setEventsList((prev) => prev.filter((e) => e.id !== eventId));
        toast.success(`Event "${eventTitle}" deleted`);
      } else {
        const fallbackRes = await deleteCivicEvent(eventId);
        if (fallbackRes.success) {
          setEventsList((prev) => prev.filter((e) => e.id !== eventId));
          toast.success(`Event "${eventTitle}" deleted`);
        } else {
          toast.error(fallbackRes.error || 'Failed to delete event');
        }
      }
    } catch {
      toast.error('Failed to delete event');
    }
  };

  const handleEventSaved = (savedRecord: CivicEventRecord) => {
    setIsEditorModalOpen(false);
    const updated: CivicEvent = {
      id: savedRecord.slug,
      title: savedRecord.title,
      category: savedRecord.category,
      dateLabel: savedRecord.date_label,
      timeLabel: savedRecord.time_label,
      isoDateStart: savedRecord.starts_at
        ? savedRecord.starts_at.replace(/[-:]/g, '').slice(0, 15)
        : '',
      isoDateEnd: savedRecord.ends_at ? savedRecord.ends_at.replace(/[-:]/g, '').slice(0, 15) : '',
      locationName: savedRecord.location_name,
      address: savedRecord.address,
      description: savedRecord.description,
      rsvpUrl: savedRecord.rsvp_url,
      highlight: savedRecord.highlight,
    };

    setEventsList((prev) => {
      const idx = prev.findIndex((e) => e.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [updated, ...prev];
    });
    toast.success(`Event "${savedRecord.title}" saved successfully`);
  };

  // Single Google Calendar builder in `@/lib/civic-events`, shared with the
  // homepage gathering card so the two links cannot drift into different shapes.
  const generateGoogleCalendarUrl = (event: CivicEvent) => buildGoogleCalendarUrl(event);

  const downloadIcsFile = (event: CivicEvent) => {
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Indivisible Fair Oaks-Carmichael//Civic Calendar//EN',
      'BEGIN:VEVENT',
      `UID:${event.id}-${Date.now()}@indivisiblefairoaks.org`,
      `DTSTAMP:${event.isoDateStart}Z`,
      `DTSTART:${event.isoDateStart}`,
      `DTEND:${event.isoDateEnd}`,
      `SUMMARY:Indivisible: ${event.title}`,
      `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
      `LOCATION:${event.locationName}, ${event.address}`,
      `URL:${event.rsvpUrl}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `${event.id}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Controls: Search and Filter Chips */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl bg-surface-card border border-border dark:bg-secondary dark:border-white/10 backdrop-blur-md shadow-xs">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-ink-muted-on-dark"
            size={16}
          />
          <input
            type="text"
            placeholder={
              dataPoints['events.search.placeholder'] || 'Search actions, meetings, or locations...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-muted border border-border dark:bg-secondary dark:border-slate-700 text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeCategory === cat
                  ? 'bg-primary-bright text-white shadow-md'
                  : 'bg-surface-muted text-muted-foreground hover:text-foreground border border-border dark:bg-secondary/60 dark:border-transparent dark:text-ink-muted-on-dark dark:hover:text-slate-200 dark:hover:bg-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* In-Page Admin Add Event Trigger */}
        {isAdmin && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-gold hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md transition-all shrink-0 cursor-pointer"
          >
            <Plus size={15} />
            <span>Add Event</span>
          </button>
        )}
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 gap-6">
        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-surface-card border border-border dark:bg-secondary dark:border-white/10 text-muted-foreground dark:text-ink-muted-on-dark">
            <DataPoint as="span" name="events.empty.desc" initialData={dataPoints}>
              No events found matching your criteria. Try selecting &ldquo;All Actions&rdquo; or
              clearing the search query.
            </DataPoint>
          </div>
        ) : (
          // A live region on the *list container*, not on each result: a
          // screen reader should hear "6 events" once, not six announcements as
          // the grid renders. The count is the information a sighted user gets
          // from the list reflowing under them.
          <>
            <p role="status" aria-live="polite" className="sr-only">
              {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'} shown
            </p>
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className={`rounded-2xl p-6 sm:p-8 transition-all relative overflow-hidden flex flex-col justify-between shadow-xs ${
                  event.highlight
                    ? 'bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/80 border border-primary/30 dark:from-blue-950/60 dark:via-slate-900 dark:to-indigo-950/60 dark:border-primary-bright/40 shadow-xl'
                    : 'bg-surface-card border border-border hover:border-primary/40 dark:bg-secondary dark:border-white/10 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary-dark dark:bg-white/5 dark:text-primary-on-dark text-xs font-mono font-semibold">
                        {event.category === 'Resistance Choir' && <Music size={12} />}
                        {event.category}
                      </span>
                      {event.highlight && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-accent-gold/20 text-accent dark:text-accent-gold text-[11px] font-bold uppercase tracking-wider">
                          Featured Gathering
                        </span>
                      )}
                    </div>

                    {/* Admin in-page action bar */}
                    {isAdmin && (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/90 border border-accent-gold/40 shadow-sm backdrop-blur-md">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(event)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-gold hover:text-white transition-colors cursor-pointer"
                          title="Edit this event"
                        >
                          <PenLine size={12} />
                          <span>Edit</span>
                        </button>
                        <span className="text-white/20">|</span>
                        <ConfirmAction
                          label={`Delete event ${event.title}`}
                          message={`Delete event "${event.title}" from the calendar?`}
                          danger
                          onConfirm={() => handleDeleteEvent(event.id, event.title)}
                          idleClassName="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </ConfirmAction>
                      </div>
                    )}
                  </div>

                  <h3 className="text-xl sm:text-2xl font-black text-foreground dark:text-white tracking-tight mb-4">
                    {event.title}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm text-foreground/80 dark:text-ink-on-dark mb-5">
                    <div className="flex items-center gap-2.5">
                      <Clock
                        size={16}
                        className="text-primary dark:text-primary-on-dark-muted shrink-0"
                      />
                      <div>
                        <span className="font-semibold text-foreground dark:text-white block">
                          {event.dateLabel}
                        </span>
                        <span className="text-muted-foreground dark:text-ink-muted-on-dark text-xs">
                          {event.timeLabel}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <MapPin
                        size={16}
                        className="text-accent dark:text-accent-gold shrink-0 mt-0.5"
                      />
                      <div>
                        <span className="font-semibold text-foreground dark:text-white block">
                          {event.locationName}
                        </span>
                        <span className="text-muted-foreground dark:text-ink-muted-on-dark text-xs">
                          {event.address}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark leading-relaxed mb-6">
                    {event.description}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-border dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {/* Google Calendar Link */}
                    <a
                      href={generateGoogleCalendarUrl(event)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-card hover:bg-surface-muted text-foreground border border-border dark:bg-white/5 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors"
                      title="Add event to Google Calendar"
                    >
                      <CalendarPlus
                        size={14}
                        className="text-primary dark:text-primary-on-dark-muted"
                      />
                      <span>Google Cal</span>
                    </a>

                    {/* iCal / Outlook .ics Download */}
                    <button
                      type="button"
                      onClick={() => downloadIcsFile(event)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-card hover:bg-surface-muted text-foreground border border-border dark:bg-white/5 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors"
                      title="Download iCal .ics for Apple Calendar & Outlook"
                    >
                      <Download size={14} className="text-accent dark:text-accent-gold" />
                      <span>.ics Export</span>
                    </button>
                  </div>

                  <a
                    href={event.rsvpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-bright hover:bg-primary-light text-white font-bold text-xs uppercase tracking-wider shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-secondary transition-colors duration-300 ease-out"
                  >
                    <span>RSVP for Event</span>
                    <ExternalLink size={13} aria-hidden="true" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Admin Event Edit Modal */}
      {isEditorModalOpen && (
        <CivicEventEditorModal
          isOpen={isEditorModalOpen}
          onClose={() => setIsEditorModalOpen(false)}
          event={selectedEventForEdit}
          onSaved={handleEventSaved}
        />
      )}
    </div>
  );
}
