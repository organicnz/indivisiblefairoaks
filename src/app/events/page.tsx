import type { Metadata } from 'next';
import { ChoirStreetSpotlight } from '@/components/events/ChoirStreetSpotlight';
import { EventsArchiveSection } from '@/components/events/EventsArchiveSection';
import { EventsMasthead } from '@/components/events/EventsMasthead';
import { EventsNonviolenceBanner } from '@/components/events/EventsNonviolenceBanner';
import { EventsTrainingsSection } from '@/components/events/EventsTrainingsSection';
import { EventsUpcomingSection } from '@/components/events/EventsUpcomingSection';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints, getUpcomingEventData } from '@/lib/queries/civic';
import { getLegacyDocuments } from '@/lib/queries/legacy';

export const metadata: Metadata = pageMetadata({
  title: 'Events & Actions',
  description:
    'Join our upcoming chapter meetings, singing protests with the Carmichael Resistance Choir, weekly rallies, and voter mobilization events in Sacramento County.',
  path: '/events',
});

export default async function EventsPage() {
  const [upcoming, dataPoints, legacyEventDocuments] = await Promise.all([
    getUpcomingEventData(),
    getDataPoints('events'),
    getLegacyDocuments('event'),
  ]);
  // Issue #175: keep past one-off events out of the public upcoming list. The
  // rows remain available to admins through /admin/events; recurring rows are
  // retained by the cached filter. The server render must contain the next
  // meeting too, not only the hydrated client. The December 1 fallback is
  // included only while it is still upcoming; after that, the public list has
  // no fabricated meeting and the homepage shows a "date to be announced"
  // state until an admin adds the next row.
  const fallbackMeeting = upcoming.fallbackMeeting
    ? { ...upcoming.fallbackMeeting, category: 'Meetings' as const }
    : undefined;
  const eventsWithFallback = upcoming.nextMeeting
    ? upcoming.events
    : fallbackMeeting
      ? [fallbackMeeting, ...upcoming.events.filter((event) => event.id !== fallbackMeeting.id)]
      : upcoming.events;
  const initialEvents = eventsWithFallback.length > 0 ? eventsWithFallback : undefined;

  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <EventsMasthead dataPoints={dataPoints} />

      <div className="mx-auto max-w-5xl space-y-12 px-4 py-16 sm:px-6 lg:px-8">
        <EventsUpcomingSection dataPoints={dataPoints} initialEvents={initialEvents} />
        <ChoirStreetSpotlight dataPoints={dataPoints} />
        <EventsTrainingsSection dataPoints={dataPoints} />
        <EventsArchiveSection legacyEventDocuments={legacyEventDocuments} />
        <EventsNonviolenceBanner dataPoints={dataPoints} />
      </div>
    </div>
  );
}
