import { Mail } from 'lucide-react';
import {
  type CivicEvent,
  InteractiveEventsCalendar,
} from '@/components/ui/InteractiveEventsCalendar';
import { EVENT_SUBMISSION_HREF } from './events-copy';

type EventsUpcomingSectionProps = {
  dataPoints: Record<string, string>;
  initialEvents?: CivicEvent[];
};

export function EventsUpcomingSection({
  dataPoints,
  initialEvents,
}: EventsUpcomingSectionProps) {
  return (
        <section aria-labelledby="upcoming-events">
          <div className="civic-section-head">
            <div>
              <h2 id="upcoming-events" className="civic-section-title">
                Upcoming events
              </h2>
            </div>
            <div className="flex flex-col items-start gap-3">
              <p className="civic-lede">
                Meetings, street actions, choir rehearsals and trainings. Filter by the kind of work
                you want to do, then RSVP with the organizer.
              </p>
              <a
                href={EVENT_SUBMISSION_HREF}
                title="Email the chapter to propose a community event. Events are reviewed before they appear."
                className="inline-flex min-h-11 items-center gap-1.5 border border-border bg-surface-card px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Mail className="size-3.5" aria-hidden="true" />
                Submit an event
              </a>
            </div>
          </div>
          <InteractiveEventsCalendar initialEvents={initialEvents} initialData={dataPoints} />
        </section>
  );
}
