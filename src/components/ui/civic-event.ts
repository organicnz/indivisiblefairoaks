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
  /** Preserved when the public calendar opens an event in the admin editor. */
  sortOrder?: number;
}

