'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import {
  CalendarPlus,
  ChevronDown,
  Clock,
  Download,
  ExternalLink,
  MapPin,
  Music,
  PenLine,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { CivicEventEditorModal } from '@/components/admin/civic/CivicEventEditorModal';
import { MobilizeImportModal } from '@/components/admin/civic/MobilizeImportModal';
import { useEditContext } from '@/components/layout/useEditContext';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';
import { type CivicEventRecord, deleteCivicEvent } from '@/lib/actions/civic';
import { instantToPacificBasic } from '@/lib/calendar-time';
import { buildGoogleCalendarUrl, buildIcsCalendar } from '@/lib/civic-events';
import { captureAnalyticsEvent } from '@/lib/posthog';

export interface CivicEvent {
  id: string;
  title: string;
  category:
    | 'Meetings'
    | 'Resistance Choir'
    | 'Voter Mobilization'
    | 'Rallies & Street Action'
    | 'Community';
  dateLabel: string;
  timeLabel: string;
  /**
   * Raw UTC instants. The edit modal writes these back: without them it saved
   * every event with `starts_at: null`, which quietly broke the Calendar and
   * .ics links of any event an admin touched from the calendar.
   */
  startsAt?: string | null;
  endsAt?: string | null;
  /** Pacific wall stamps (`YYYYMMDDTHHMMSS`, no `Z`) — see `@/lib/calendar-time`. */
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
  // Issue #153: Mobilize's COMMUNITY / POSTCARD_WRITING / WORKSHOP events have
  // no honest home among the four editorial categories.
  'Community',
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [eventsList, setEventsList] = useState<CivicEvent[]>(
    initialEvents && initialEvents.length > 0 ? initialEvents : EVENTS
  );
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<CivicEventRecord | null>(null);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [isMobilizeModalOpen, setIsMobilizeModalOpen] = useState(false);

  const refreshEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/civic/events');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.events) && data.events.length > 0) {
          setEventsList(data.events);
        }
      }
    } catch {
      // Fall back gracefully to existing state
    }
  }, []);

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
      starts_at: event.startsAt ?? null,
      ends_at: event.endsAt ?? null,
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
      // Issue #149: a saved record arrives as a UTC instant; render it as
      // Pacific wall time — the zone the links and the .ics pin explicitly —
      // instead of slicing the string into a floating stamp the viewer's
      // clock reinterprets (the original 2:30 AM bug).
      startsAt: savedRecord.starts_at,
      endsAt: savedRecord.ends_at,
      isoDateStart: instantToPacificBasic(savedRecord.starts_at),
      isoDateEnd: instantToPacificBasic(savedRecord.ends_at),
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
  // homepage gathering card so the two links cannot drift into different shapes
  // (and, since issue #149, cannot drift on the timezone contract either).
  const generateGoogleCalendarUrl = (event: CivicEvent) => buildGoogleCalendarUrl(event);

  const downloadIcsFile = (event: CivicEvent) => {
    // The VCALENDAR text (TZID + VTIMEZONE, RFC-stamped) lives with the other
    // calendar builders so the download and the links stay one contract.
    const icsContent = buildIcsCalendar(event);

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `${event.id}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFiltersWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // When using a vertical scroll wheel (deltaY) over the single-line filters,
    // convert it to smooth horizontal scrolling.
    if (e.deltaY !== 0 && e.deltaX === 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  const handleCategoryClick = (cat: string, e: React.MouseEvent<HTMLButtonElement>) => {
    setActiveCategory(cat);
    e.currentTarget?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  };

  return (
    <div className="space-y-8">
      {/* Controls: Expandable Search, Single-Line Scrollable Filters, and Admin Actions */}
      <div className="relative z-20 flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-2xl bg-surface-card border border-border backdrop-blur-md shadow-xs">
        {/* Expandable Search Button & Input */}
        <div
          className={`relative flex items-center transition-all duration-300 ease-out shrink-0 ${
            isSearchOpen || searchQuery ? 'w-52 sm:w-64 md:w-72' : 'w-9'
          }`}
        >
          {/* Collapsed Search Icon Button */}
          {!isSearchOpen && !searchQuery && (
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              aria-label="Search events"
              className="size-9 rounded-full bg-surface-muted/80 dark:bg-slate-800/80 hover:bg-surface-muted dark:hover:bg-slate-750 border border-border dark:border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground dark:text-ink-muted-on-dark dark:hover:text-white transition-all cursor-pointer shadow-xs"
            >
              <Search size={16} />
            </button>
          )}

          {/* Expanded / Always-Mounted Search Input Field */}
          <div
            className={`relative w-full flex items-center transition-opacity duration-200 ${
              isSearchOpen || searchQuery
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none absolute inset-0'
            }`}
          >
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-ink-muted-on-dark pointer-events-none"
              size={15}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={
                dataPoints['events.search.placeholder'] ||
                'Search actions, meetings, or locations...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchOpen(true)}
              onBlur={() => {
                if (!searchQuery) {
                  setIsSearchOpen(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  setIsSearchOpen(false);
                  searchInputRef.current?.blur();
                }
              }}
              className="w-full pl-9 pr-8 py-1.5 rounded-full bg-surface-muted dark:bg-slate-800/90 border border-border dark:border-white/15 text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-ink-muted-on-dark text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
            {(isSearchOpen || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchOpen(false);
                  searchInputRef.current?.blur();
                }}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground dark:text-ink-muted-on-dark dark:hover:text-white transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category Filters (Single-line, horizontally scrollable via vertical mouse wheel) */}
        <div
          onWheel={handleFiltersWheel}
          className="flex items-center gap-1.5 flex-nowrap overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-1 min-w-0 py-1"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={(e) => handleCategoryClick(cat, e)}
              className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-primary-bright text-white shadow-md'
                  : 'bg-surface-muted text-muted-foreground hover:text-foreground border border-border dark:bg-secondary/60 dark:border-transparent dark:text-ink-muted-on-dark dark:hover:text-ink-on-dark dark:hover:bg-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* In-Page Admin Controls (Issue #153: unified dropdown with Add Event & Import Mobilize) */}
        {isAdmin && (
          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Add or import event"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-gold hover:brightness-105 text-ink-strong font-black text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer select-none"
                >
                  <Plus size={15} />
                  <span>Add Event</span>
                  <ChevronDown size={14} className="opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <DropdownMenuContent
                  align="end"
                  sideOffset={6}
                  className="z-[9999] min-w-56 rounded-2xl bg-surface-card dark:bg-slate-900 p-2 shadow-2xl border border-border dark:border-white/10 backdrop-blur-xl animate-in fade-in-0 zoom-in-95"
                >
                  <DropdownMenuItem
                    className="flex items-start gap-3 p-2.5 rounded-xl cursor-pointer outline-none transition-colors hover:bg-surface-muted dark:hover:bg-white/10"
                    onClick={handleOpenCreateModal}
                  >
                    <div className="size-8 rounded-lg bg-accent-gold/20 text-accent-gold flex items-center justify-center shrink-0 mt-0.5">
                      <Plus size={16} />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-foreground dark:text-white">
                        Add Event
                      </span>
                      <span className="block text-[11px] text-muted-foreground dark:text-ink-muted-on-dark">
                        Manually create a new civic event
                      </span>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="flex items-start gap-3 p-2.5 rounded-xl cursor-pointer outline-none transition-colors hover:bg-surface-muted dark:hover:bg-white/10 mt-1"
                    onClick={() => setIsMobilizeModalOpen(true)}
                  >
                    <div className="size-8 rounded-lg bg-primary/15 text-primary-bright dark:text-accent-gold flex items-center justify-center shrink-0 mt-0.5">
                      <Download size={16} />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-foreground dark:text-white">
                        Import Mobilize
                      </span>
                      <span className="block text-[11px] text-muted-foreground dark:text-ink-muted-on-dark">
                        1-click import from any Mobilize URL
                      </span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 gap-6">
        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-surface-card border border-border text-muted-foreground dark:text-ink-muted-on-dark">
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
                    : 'bg-surface-card border border-border hover:border-primary/40 dark:bg-secondary dark:border-white/10 dark:hover:border-white/20'
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
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-card hover:bg-surface-muted text-foreground border border-border dark:bg-white/5 dark:hover:bg-white/10 dark:text-ink-on-dark dark:border-white/10 text-xs font-semibold transition-colors"
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
                      onClick={() => {
                        downloadIcsFile(event);
                        captureAnalyticsEvent('event_calendar_downloaded', { event_id: event.id });
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-card hover:bg-surface-muted text-foreground border border-border dark:bg-white/5 dark:hover:bg-white/10 dark:text-ink-on-dark dark:border-white/10 text-xs font-semibold transition-colors"
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
                    onClick={() =>
                      captureAnalyticsEvent('event_rsvp_clicked', { event_id: event.id })
                    }
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

      {/* Admin In-Page Mobilize Event Import Modal (issue #153) */}
      <MobilizeImportModal
        isOpen={isMobilizeModalOpen}
        onClose={() => setIsMobilizeModalOpen(false)}
        onSuccess={() => {
          refreshEvents();
        }}
      />
    </div>
  );
}
