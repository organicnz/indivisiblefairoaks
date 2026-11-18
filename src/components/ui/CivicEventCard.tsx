import { CalendarPlus, Clock, Download, ExternalLink, MapPin, Music, PenLine, Trash2 } from 'lucide-react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import type { CivicEvent } from '@/components/ui/civic-event';
import { captureAnalyticsEvent } from '@/lib/posthog';

export function CivicEventCard({
  event,
  isAdmin,
  googleCalendarUrl,
  onEdit,
  onDelete,
  onDownloadIcs,
}: {
  event: CivicEvent;
  isAdmin: boolean;
  googleCalendarUrl: string;
  onEdit: (event: CivicEvent) => void;
  onDelete: (eventId: string, eventTitle: string) => void;
  onDownloadIcs: (event: CivicEvent) => void;
}) {
  return (
<div
  className={`relative flex flex-col justify-between overflow-hidden rounded-sm border p-6 transition-colors sm:p-8 ${
    event.highlight
      ? 'border-foreground/25 border-l-4 border-l-primary bg-surface-muted'
      : 'border-border bg-surface-card hover:border-primary/40'
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
            onClick={() => onEdit(event)}
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
            onConfirm={() => onDelete(event.id, event.title)}
            idleClassName="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
          >
            <Trash2 size={12} />
            <span>Delete</span>
          </ConfirmAction>
        </div>
      )}
    </div>

    <h3 className="mb-4 font-display text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">
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
        href={googleCalendarUrl}
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
          onDownloadIcs(event);
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
  );
}
