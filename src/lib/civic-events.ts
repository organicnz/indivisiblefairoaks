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

import {
  instantToPacificBasic,
  PACIFIC_TZ,
  PACIFIC_VTIMEZONE_LINES,
} from '@/lib/calendar-time';

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
 * Issue #175: "Ongoing" and "Every …" rows describe recurring activity, not
 * a single dated event. Their stored start instant is the first occurrence,
 * so treating it as an expiry date would hide the choir's standing protest
 * and rehearsal from the public calendar. One-off events are different: once
 * their end instant has passed they belong in the archive, not the upcoming
 * list.
 */
const RECURRING_DATE_LABEL = /^\s*(?:ongoing|every)\b/i;

export function isRecurringEvent(event: Pick<CardEvent, 'dateLabel'>): boolean {
  return RECURRING_DATE_LABEL.test(event.dateLabel);
}

/**
 * Is this event still current for the public "Upcoming events" surface?
 *
 * The comparison uses Pacific wall stamps because the event rows are authored
 * and displayed in the chapter's timezone; comparing a Pacific wall clock to
 * the server's local clock would shift the cutoff by the host's offset. An
 * undated row is kept because it cannot be proven past.
 */
export function isEventUpcoming(
  event: Pick<CardEvent, 'dateLabel' | 'isoDateStart' | 'isoDateEnd'>,
  now: Date = new Date()
): boolean {
  if (isRecurringEvent(event) || !event.isoDateStart) return true;
  const endStamp = event.isoDateEnd || event.isoDateStart;
  const nowStamp = instantToPacificBasic(now.toISOString());
  return endStamp >= nowStamp;
}

export function filterUpcomingEvents<T extends Pick<CardEvent, 'dateLabel' | 'isoDateStart' | 'isoDateEnd'>>(
  events: readonly T[],
  now: Date = new Date()
): T[] {
  return events.filter((event) => isEventUpcoming(event, now));
}

/**
 * The confirmed next chapter meeting, used when the database has no future
 * highlighted meeting. Erin gave the date (December 1); the recurring monthly
 * time and venue are the chapter's established pattern and remain editable
 * through `/admin/events`.
 */
export const DEFAULT_UPCOMING_MEETING: CardEvent = {
  id: 'monthly-gathering-dec',
  title: 'Monthly Chapter Meeting & Food Drive',
  category: 'Meetings',
  dateLabel: 'Tuesday, December 1, 2026',
  timeLabel: '6:30 PM – 8:00 PM',
  isoDateStart: '20261201T183000',
  isoDateEnd: '20261201T200000',
  locationName: "St. Michael's Episcopal Church",
  address: '2140 Mission Avenue, Carmichael, CA 95608',
  description:
    'Our next monthly community gathering. Bring a can or box of non-perishable food for our neighborhood pantry; agenda and updates will be shared at the meeting.',
  rsvpUrl: 'https://www.mobilize.us/indivisible/',
  highlight: true,
};

/**
 * The static December 1 fallback is valid only while it is still upcoming.
 * After that date the callers must render the honest "date to be announced"
 * state instead of advertising a meeting that has already happened.
 */
export function getFallbackMeeting(now: Date = new Date()): CardEvent | undefined {
  return isEventUpcoming(DEFAULT_UPCOMING_MEETING, now) ? DEFAULT_UPCOMING_MEETING : undefined;
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
 * The homepage's next-meeting choice. Unlike `selectMeetingEvent`, this is
 * date-aware: a past meeting is never announced merely because it has the
 * lowest sort order. A future row must be highlighted or look like the
 * chapter meeting, so a future choir rehearsal or coffee klatch cannot inherit
 * the food-drive card. When there is no future meeting, the caller renders
 * `DEFAULT_UPCOMING_MEETING`.
 */
export function selectUpcomingMeetingEvent(
  events: readonly CardEvent[],
  now: Date = new Date()
): CardEvent | undefined {
  return events
    .filter(
      (event) =>
        event.category === 'Meetings' &&
        !isRecurringEvent(event) &&
        Boolean(event.isoDateStart) &&
        isEventUpcoming(event, now) &&
        (event.highlight || /\bchapter\b/i.test(event.title))
    )
    .sort((a, b) => a.isoDateStart.localeCompare(b.isoDateStart))[0];
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
  calendarUrl: string | null;
  isScheduled: boolean;
}

/**
 * Maps the selected event onto the card, or onto the still-upcoming fallback
 * when the table holds no meeting. When neither exists, the card says so
 * instead of reusing a past date. The fallback is the December 1 chapter
 * meeting; its stamps are Pacific wall time with `ctz` (issue #149), the same
 * shape the builder emits.
 */
export function gatheringCard(
  event: CardEvent | undefined,
  fallbackMeeting?: CardEvent
): GatheringCard {
  if (!event && fallbackMeeting) {
    return {
      title: fallbackMeeting.title,
      dateLine: `${fallbackMeeting.dateLabel} • ${fallbackMeeting.timeLabel}`,
      locationLine: `${fallbackMeeting.locationName}, ${fallbackMeeting.address}`,
      rsvpUrl: fallbackMeeting.rsvpUrl,
      calendarUrl: buildGoogleCalendarUrl(fallbackMeeting),
      isScheduled: true,
    };
  }
  if (!event) {
    return {
      title: 'Next Chapter Meeting',
      dateLine: 'Date to be announced',
      locationLine: 'Location to be announced',
      rsvpUrl: 'mailto:contact@indivisiblefairoaks.org?subject=Next%20chapter%20meeting',
      calendarUrl: null,
      isScheduled: false,
    };
  }
  return {
    title: event.title,
    dateLine: `${event.dateLabel} • ${event.timeLabel}`,
    locationLine: `${event.locationName}, ${event.address}`,
    rsvpUrl: event.rsvpUrl,
    calendarUrl: buildGoogleCalendarUrl(event),
    isScheduled: true,
  };
}
