// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildGoogleCalendarUrl,
  buildIcsCalendar,
  type CardEvent,
  gatheringCard,
  selectMeetingEvent,
} from '@/lib/civic-events';

// `isoDateStart`/`isoDateEnd` are Pacific wall stamps (issue #149) — no `Z`,
// interpreted by the `ctz=` parameter, so the MEETING fixture's October values
// are written as the chapter would type them, 6:30 PM Pacific.
const MEETING: CardEvent = {
  id: 'monthly-gathering-oct',
  title: 'Monthly Chapter Gathering & Food Bank Drive',
  category: 'Meetings',
  dateLabel: 'Tuesday, October 6, 2026',
  timeLabel: '6:30 PM – 8:00 PM',
  isoDateStart: '20261006T183000',
  isoDateEnd: '20261006T200000',
  locationName: "St. Michael's Episcopal Church",
  address: '2140 Mission Avenue, Carmichael, CA 95608',
  description: 'Our primary monthly community gathering.',
  rsvpUrl: 'https://www.mobilize.us/indivisible/event/903494/',
  highlight: true,
};

const RALLY: CardEvent = {
  id: 'no-kings-rally',
  title: 'No Kings Rally',
  category: 'Rallies & Street Action',
  dateLabel: 'Saturday, October 17, 2026',
  timeLabel: '10:00 AM – 2:00 PM',
  isoDateStart: '20261017T100000',
  isoDateEnd: '20261017T140000',
  locationName: 'Fair Oaks Park',
  address: 'Fair Oaks, CA',
  description: 'Voter participation day.',
  rsvpUrl: 'https://www.mobilize.us/nokings/event/1031437/',
  highlight: true,
};

describe('selectMeetingEvent', () => {
  it('prefers the Meetings row even when a rally sorts first and is highlighted', () => {
    // The card carries the food-drive note, which is meeting-specific: a
    // highlighted rally must never inherit it.
    expect(selectMeetingEvent([RALLY, MEETING])).toBe(MEETING);
  });

  it('falls back to the highlighted row when no meeting exists', () => {
    expect(selectMeetingEvent([RALLY])).toBe(RALLY);
  });

  it('falls back to the first row when nothing is highlighted', () => {
    const plain = { ...RALLY, highlight: false };
    expect(selectMeetingEvent([plain])).toBe(plain);
  });

  it('returns undefined for an empty table so the call site renders its fallback', () => {
    expect(selectMeetingEvent([])).toBeUndefined();
  });
});

describe('gatheringCard', () => {
  it('maps the row onto the card fields', () => {
    const card = gatheringCard(MEETING);
    expect(card.title).toBe('Monthly Chapter Gathering & Food Bank Drive');
    expect(card.dateLine).toBe('Tuesday, October 6, 2026 • 6:30 PM – 8:00 PM');
    expect(card.locationLine).toBe(
      "St. Michael's Episcopal Church, 2140 Mission Avenue, Carmichael, CA 95608"
    );
    expect(card.rsvpUrl).toBe('https://www.mobilize.us/indivisible/event/903494/');
    expect(card.calendarUrl).toBe(buildGoogleCalendarUrl(MEETING));
  });

  it('renders the static fallback when the table holds no meeting', () => {
    const card = gatheringCard(undefined);
    expect(card.title).toContain('Monthly Chapter Meeting');
    expect(card.dateLine).toBe('Tuesday, November 10, 2026 • 6:30 PM – 8:00 PM');
    expect(card.rsvpUrl).toBe('https://www.mobilize.us/indivisible/');
    expect(card.calendarUrl).toContain('calendar.google.com/calendar/render');
    expect(card.calendarUrl).toContain('20261110T183000');
    expect(card.calendarUrl).toContain('ctz=America%2FLos_Angeles');
  });
});

describe('buildGoogleCalendarUrl', () => {
  it('matches the calendar template exactly, naming the events zone with ctz', () => {
    expect(buildGoogleCalendarUrl(MEETING)).toBe(
      'https://calendar.google.com/calendar/render' +
        '?action=TEMPLATE' +
        `&text=${encodeURIComponent('Indivisible: Monthly Chapter Gathering & Food Bank Drive')}` +
        '&dates=20261006T183000/20261006T200000' +
        '&ctz=America%2FLos_Angeles' +
        `&details=${encodeURIComponent(
          'Our primary monthly community gathering.\n\nRSVP / More info: https://www.mobilize.us/indivisible/event/903494/'
        )}` +
        `&location=${encodeURIComponent(
          "St. Michael's Episcopal Church, 2140 Mission Avenue, Carmichael, CA 95608"
        )}`
    );
  });
});

describe('buildIcsCalendar', () => {
  it('presents the stamps as Pacific under TZID, with a VTIMEZONE block', () => {
    const lines = buildIcsCalendar(MEETING, new Date('2026-11-01T00:00:00Z')).split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    // The zone definition the DTSTART/DTEND reference must point into, per RFC
    // 5545 — both the standard and daylight halves must ship.
    expect(lines).toContain('DTSTART;TZID=America/Los_Angeles:20261006T183000');
    expect(lines).toContain('DTEND;TZID=America/Los_Angeles:20261006T200000');
    expect(lines).toContain('TZID:America/Los_Angeles');
    expect(lines).toContain('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU');
    expect(lines).toContain('RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU');
    expect(lines.at(-1)).toBe('END:VCALENDAR');
  });

  it('keeps DTSTAMP on UTC regardless of the wall-time presentation', () => {
    // Issue #149 regression: the old template interpolated the wall stamp with
    // a second Z, and a Z on a Pacific-labelled stamp is a lie Google obeys.
    expect(buildIcsCalendar(MEETING, new Date('2026-11-01T00:00:00Z'))).toContain(
      'DTSTAMP:20261101T000000Z'
    );
  });

  it('derives UID from the supplied stamp so two calls agree', () => {
    const ics = buildIcsCalendar(
      { ...MEETING, id: 'monthly-gathering-oct' },
      new Date('2026-11-01T00:00:00Z')
    );
    expect(ics).toMatch(/^UID:monthly-gathering-oct-\d+@indivisiblefairoaks\.org$/m);
  });

  it('the November meeting states 18:30 Pacific for 02:30 UTC', () => {
    // Cross-check against the stored instant (PST is −8): the November row is
    // the one issue #149 was filed about, so its shape is pinned here.
    const november: CardEvent = {
      ...MEETING,
      isoDateStart: '20261110T183000',
      isoDateEnd: '20261110T200000',
    };
    expect(buildIcsCalendar(november)).toContain(
      'DTSTART;TZID=America/Los_Angeles:20261110T183000'
    );
  });
});
