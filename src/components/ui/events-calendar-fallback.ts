import type { CivicEvent } from '@/components/ui/civic-event';
import {
  filterUpcomingEvents,
  getFallbackMeeting,
  selectUpcomingMeetingEvent,
} from '@/lib/civic-events';

export const EVENTS: CivicEvent[] = [
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
    rsvpUrl: 'https://www.mobilize.us/indivisible/event/1072857/',
  },
];

/**
 * Keep the public calendar date-aware: past one-off events disappear, recurring
 * rows stay, and the still-upcoming December 1 meeting fills the gap while the
 * database has no future highlighted chapter meeting. Once that fallback has
 * passed, no fabricated meeting is inserted. The admin pages use a separate
 * data path, so old rows remain editable and removable there.
 */
export function withUpcomingFallback(events: CivicEvent[]): CivicEvent[] {
  const upcoming = filterUpcomingEvents(events);
  if (selectUpcomingMeetingEvent(upcoming)) return upcoming;
  const fallback = getFallbackMeeting();
  if (!fallback) return upcoming;
  return [
    { ...fallback, category: 'Meetings' },
    ...upcoming.filter((event) => event.id !== fallback.id),
  ];
}
