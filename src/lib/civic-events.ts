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

import { PACIFIC_TZ, PACIFIC_VTIMEZONE_LINES } from '@/lib/calendar-time';

/** Minimal shape the card and calendar links need. `CivicEvent` satisfies it. */
export interface CardEvent {
  id: string;
  title: string;
  category: string;
  dateLabel: string;
  timeLabel: string;
  /** Pacific wall stamp (`YYYYMMDDTHHMMSS`, no `Z`) — see `calendar-time.ts`. */
  isoDateStart: string;
  /** Pacific wall stamp (`YYYYMMDDTHHMMSS`, no `Z`) — see `calendar-time.ts`. */
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
 *
 * Issue #149: `dates=[
]` and `ctz=` go together. The stamps are Pacific
 * wall time (see `calendar-time.ts`); without `ctz` Google reinterprets the
 * naive stamps in the *viewer's* timezone, which put Pacific users at 2:30 AM.
 */
export function buildGoogleCalendarUrl(event: CardEvent): string {
  const title = encodeURIComponent(`Indivisible: ${event.title}`);
  const details = encodeURIComponent(`${event.description}\n\nRSVP / More info: ${event.rsvpUrl}`);
  const location = encodeURIComponent(`${event.locationName}, ${event.address}`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${event.isoDateStart}/${event.isoDateEnd}&ctz=${encodeURIComponent(PACIFIC_TZ)}&details=${details}&location=${location}`;
}

/**
 * RFC 5545 VCALENDAR text for one event download. `DTSTART`/`DTEND` present the
 * Pacific wall stamps under `TZID=America/Los_Angeles` with the VTIMEZONE
 * block that makes the TZID reference interoperable rather than merely
 * tolerated by big clients; `DTSTAMP` stays UTC with `Z` regardless of the
 * zone the times are presented in, and is the instant of generation per RFC
 * 5545 — which for this surface *is* the moment of the download, so it is
 * derived from the passed date rather than from the event.
 */
export function buildIcsCalendar(event: CardEvent, stamp: Date = new Date()): string {
  const utcStamp = stamp
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Indivisible Fair Oaks-Carmichael//Civic Calendar//EN',
    ...PACIFIC_VTIMEZONE_LINES,
    'BEGIN:VEVENT',
    `UID:${event.id}-${stamp.getTime()}@indivisiblefairoaks.org`,
    `DTSTAMP:${utcStamp}`,
    `DTSTART;TZID=${PACIFIC_TZ}:${event.isoDateStart}`,
    `DTEND;TZID=${PACIFIC_TZ}:${event.isoDateEnd}`,
    `SUMMARY:Indivisible: ${event.title}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    `LOCATION:${event.locationName}, ${event.address}`,
    `URL:${event.rsvpUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
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
 * table holds no meeting. The fallback is the November chapter meeting the
 * card hardcoded before issue #37 — it renders only when the backend cannot
 * supply a row, never as a substitute for updating one. Its stamps are Pacific
 * wall time with `ctz` (issue #149), the same shape the builder emits.
 */
export function gatheringCard(event: CardEvent | undefined): GatheringCard {
  if (!event) {
    return {
      title: 'Monthly Chapter Meeting & Food Drive',
      dateLine: 'Tuesday, November 10, 2026 • 6:30 PM – 8:00 PM',
      locationLine: "St. Michael's Episcopal Church, 2140 Mission Ave, Carmichael",
      rsvpUrl: 'https://www.mobilize.us/indivisible/',
      calendarUrl:
        'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Indivisible+Fair+Oaks-Carmichael+Monthly+Meeting&dates=20261110T183000/20261110T200000&ctz=America%2FLos_Angeles&details=Monthly+community+gathering+and+food+drive.+Bring+non-perishable+food+for+the+local+food+bank.&location=St.+Michael%27s+Episcopal+Church%2C+2140+Mission+Ave%2C+Carmichael%2C+CA',
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
