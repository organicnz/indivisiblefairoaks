// Homepage "Next Community Gathering" card data source.
//
// Issue #37: the old Google Sites homepage was updated to the October meeting
// while the new platform hardcoded "Tuesday, September 1" in JSX, so the two
// sites disagreed with no backend write able to fix it. This module selects the
// card's event from the same `events` rows `getEvents()` already serves, so an
// organizer updating the `events` table moves the homepage with no deploy.
//
// The card is the *meeting* slot (it carries the food-drive note, which is
// meeting-specific chapter policy kept static at the call site), so selection
// prefers the Meetings category over the generic highlight flag: a highlighted
// rally must not inherit a food-drive note.

/** Minimal shape the card and calendar links need. `CivicEvent` satisfies it. */
export interface CardEvent {
  id: string;
  title: string;
  category: string;
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

/**
 * The meeting the homepage card announces: first Meetings-category row in
 * `sort_order`, else the highlighted row, else the first row. `undefined` when
 * the table is empty — the call site renders its static fallback then, the
 * same role the calendar's inline rows play pre-migration.
 */
export function selectMeetingEvent(events: readonly CardEvent[]): CardEvent | undefined {
  return (
    events.find((event) => event.category === 'Meetings') ??
    events.find((event) => event.highlight) ??
    events[0]
  );
}

/**
 * Google Calendar TEMPLATE link for an event. Single builder for the calendar's
 * per-row "Google Cal" link and the homepage card's "Add to Calendar" button, so
 * the two surfaces cannot drift into different `dates`/`details` shapes.
 */
export function buildGoogleCalendarUrl(event: CardEvent): string {
  const title = encodeURIComponent(`Indivisible: ${event.title}`);
  const details = encodeURIComponent(`${event.description}\n\nRSVP / More info: ${event.rsvpUrl}`);
  const location = encodeURIComponent(`${event.locationName}, ${event.address}`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${event.isoDateStart}/${event.isoDateEnd}&details=${details}&location=${location}`;
}

/** Render-ready fields for the homepage gathering card. */
export interface GatheringCard {
  title: string;
  dateLine: string;
  locationLine: string;
  rsvpUrl: string;
  calendarUrl: string;
}

/**
 * Maps the selected event onto the card, or onto the static fallback when the
 * table holds no meeting. The fallback is the September chapter meeting the
 * card hardcoded before issue #37 — it renders only when the backend cannot
 * supply a row, never as a substitute for updating one.
 */
export function gatheringCard(event: CardEvent | undefined): GatheringCard {
  if (!event) {
    return {
      title: 'Monthly Chapter Meeting & Food Drive',
      dateLine: 'Tuesday, September 1 • 6:30 PM – 8:00 PM',
      locationLine: "St. Michael's Episcopal Church, 2140 Mission Ave, Carmichael",
      rsvpUrl: 'https://www.mobilize.us/indivisible/',
      calendarUrl:
        'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Indivisible+Fair+Oaks-Carmichael+Monthly+Meeting&dates=20260901T183000/20260901T200000&details=Monthly+community+gathering+and+food+drive.+Bring+non-perishable+food+for+the+local+food+bank.&location=St.+Michael%27s+Episcopal+Church%2C+2140+Mission+Ave%2C+Carmichael%2C+CA',
    };
  }
  return {
    title: event.title,
    dateLine: `${event.dateLabel} • ${event.timeLabel}`,
    locationLine: `${event.locationName}, ${event.address}`,
    rsvpUrl: event.rsvpUrl,
    calendarUrl: buildGoogleCalendarUrl(event),
  };
}
