import { EVENT_CALENDAR_HREF, eventCategoryHref } from '@/lib/event-links';

export type QuickHitId = 'gatherings' | 'coffee' | 'postcards' | 'calendar';

export interface QuickHit {
  id: QuickHitId;
  labelName: string;
  detailName: string;
  label: string;
  detail: string;
  href: string;
}

/**
 * Issue #180: leadership asked for a front-and-center route to the recurring
 * chapter activities. These are navigation shortcuts, not a second event feed;
 * the calendar remains the source of truth for dates and RSVPs.
 */
export const QUICK_HITS: readonly QuickHit[] = [
  {
    id: 'gatherings',
    labelName: 'home.quick_hits.gatherings_label',
    detailName: 'home.quick_hits.gatherings_detail',
    label: 'Monthly gathering dates',
    detail: 'Chapter business, food drive, and neighborhood updates.',
    href: eventCategoryHref('Meetings'),
  },
  {
    id: 'coffee',
    labelName: 'home.quick_hits.coffee_label',
    detailName: 'home.quick_hits.coffee_detail',
    label: 'Coffee Klatches',
    detail: 'Small-table conversation and community connection.',
    href: eventCategoryHref('Community'),
  },
  {
    id: 'postcards',
    labelName: 'home.quick_hits.postcards_label',
    detailName: 'home.quick_hits.postcards_detail',
    label: 'Postcarding & outreach',
    detail: 'Write, phone-bank, and canvass with neighbors.',
    href: eventCategoryHref('Voter Mobilization'),
  },
  {
    id: 'calendar',
    labelName: 'home.quick_hits.calendar_label',
    detailName: 'home.quick_hits.calendar_detail',
    label: 'Full chapter calendar',
    detail: 'Every meeting, action, rehearsal, and training.',
    href: EVENT_CALENDAR_HREF,
  },
] as const;

/** Each event card on the calendar carries the organizer's RSVP link. */
export const GATHERING_RSVP_HREF = EVENT_CALENDAR_HREF;

/** Workgroup sign-ups use the chapter's existing contact form. */
export const WORKGROUP_SIGNUP_HREF = '/contact?topic=workgroup#contact-form';
