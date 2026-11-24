'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

const CivicEventEditorModal = dynamic(
  () =>
    import('@/components/admin/civic/CivicEventEditorModal').then(
      (module) => module.CivicEventEditorModal
    ),
  { ssr: false }
);

const MobilizeImportModal = dynamic(
  () =>
    import('@/components/admin/civic/MobilizeImportModal').then(
      (module) => module.MobilizeImportModal
    ),
  { ssr: false }
);

import { useEditContext } from '@/components/layout/useEditContext';
import { CivicEventCard } from '@/components/ui/CivicEventCard';
import type { CivicEvent } from '@/components/ui/civic-event';
import { DataPoint } from '@/components/ui/DataPoint';
import { EVENT_CATEGORIES, EventsCalendarToolbar } from '@/components/ui/EventsCalendarToolbar';
import { EVENTS, withUpcomingFallback } from '@/components/ui/events-calendar-fallback';
import { useDataPoints } from '@/hooks/useDataPoints';
import { type CivicEventRecord, deleteCivicEvent } from '@/lib/actions/civic';
import { instantToPacificBasic } from '@/lib/calendar-time';
import { buildGoogleCalendarUrl, buildIcsCalendar } from '@/lib/civic-events';
import { fetchWithTimeout } from '@/lib/service-fetch';

export type { CivicEvent } from '@/components/ui/civic-event';

export function InteractiveEventsCalendar({
  initialEvents,
  initialData,
}: {
  initialEvents?: CivicEvent[];
  initialData?: Record<string, string>;
} = {}) {
  const { dataPoints } = useDataPoints('events', initialData);
  const { isAdmin } = useEditContext('/events');
  const [activeCategory, setActiveCategory] = useState<string>('All Actions');
  const [searchQuery, setSearchQuery] = useState('');
  // The server passes an already-filtered list. Do not call `withUpcomingFallback`
  // during the initial render: `new Date()` in a Client Component is a
  // prerender error. API refreshes happen in effects, where the current date is
  // safe to read.
  const [eventsList, setEventsList] = useState<CivicEvent[]>(() =>
    initialEvents && initialEvents.length > 0 ? initialEvents : EVENTS
  );
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<CivicEventRecord | null>(null);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [isMobilizeModalOpen, setIsMobilizeModalOpen] = useState(false);

  const refreshEvents = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/civic/events');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.events) && data.events.length > 0) {
          setEventsList(withUpcomingFallback(data.events));
        }
      }
    } catch {
      // Fall back gracefully to existing state
    }
  }, []);

  // Issue #180: homepage quick hits link to a filtered calendar. Reading the
  // query string in an effect keeps `/events` statically prerenderable while
  // still applying the requested category as soon as the page hydrates. The
  // popstate listener keeps the visible filter honest when the visitor uses
  // browser back/forward between filtered views.
  useEffect(() => {
    const applyCategoryFromUrl = () => {
      const category = new URLSearchParams(window.location.search).get('category');
      setActiveCategory(
        category && (EVENT_CATEGORIES as readonly string[]).includes(category)
          ? category
          : 'All Actions'
      );
    };

    applyCategoryFromUrl();
    window.addEventListener('popstate', applyCategoryFromUrl);
    return () => window.removeEventListener('popstate', applyCategoryFromUrl);
  }, []);

  useEffect(() => {
    // The server already rendered the cached event list. Refetching it on every
    // mount added a second request and could overwrite fresh server data with
    // an older cached API response. Only a standalone mount without server
    // data needs this fallback; admin refreshes call `refreshEvents` directly.
    if (initialEvents !== undefined) return;
    let cancelled = false;
    async function loadEventsFromApi() {
      try {
        const res = await fetchWithTimeout('/api/civic/events');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data.events) && data.events.length > 0) {
            setEventsList(withUpcomingFallback(data.events));
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
  }, [initialEvents]);

  const handleCategoryChange = useCallback((category: string) => {
    setActiveCategory(category);

    // Keep the selected category in the URL so a filtered view can be shared
    // or refreshed without losing the user's choice.
    const url = new URL(window.location.href);
    if (category === 'All Actions') {
      url.searchParams.delete('category');
    } else {
      url.searchParams.set('category', category);
    }
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`
    );
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
      // The public feed carries this now. The old hardcoded 10 silently reset
      // any custom ordering the moment an admin edited the event from here.
      sort_order: event.sortOrder ?? 10,
    });
    setIsEditorModalOpen(true);
  };

  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    try {
      const res = await fetchWithTimeout(`/api/civic/events?slug=${encodeURIComponent(eventId)}`, {
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
      sortOrder: savedRecord.sort_order,
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

  return (
    <div className="space-y-8">
      <EventsCalendarToolbar
        dataPoints={dataPoints}
        isAdmin={isAdmin}
        activeCategory={activeCategory}
        searchQuery={searchQuery}
        onCategoryChange={handleCategoryChange}
        onSearchQueryChange={setSearchQuery}
        onAddEvent={handleOpenCreateModal}
        onImportMobilize={() => setIsMobilizeModalOpen(true)}
      />

      {/* Events Grid */}
      <div className="grid grid-cols-1 gap-6">
        {filteredEvents.length === 0 ? (
          <div className="border-y border-border bg-surface-card p-12 text-center text-muted-foreground">
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
              <CivicEventCard
                key={event.id}
                event={event}
                isAdmin={isAdmin}
                googleCalendarUrl={buildGoogleCalendarUrl(event)}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteEvent}
                onDownloadIcs={downloadIcsFile}
              />
            ))}
          </>
        )}
      </div>

      {/* Admin Event Edit Modal — loaded only after an admin opens it. */}
      {isEditorModalOpen && (
        <CivicEventEditorModal
          isOpen={isEditorModalOpen}
          onClose={() => setIsEditorModalOpen(false)}
          event={selectedEventForEdit}
          onSaved={handleEventSaved}
        />
      )}

      {/* Admin In-Page Mobilize Event Import Modal (issue #153) */}
      {isMobilizeModalOpen && (
        <MobilizeImportModal
          isOpen
          onClose={() => setIsMobilizeModalOpen(false)}
          onSuccess={() => {
            refreshEvents();
          }}
        />
      )}
    </div>
  );
}
