// Mobilize → `public.events`, as pure functions.
//
// Issue #153. This module is the single mapping both halves of the feature use:
// the scheduled Edge Function (`supabase/functions/sync-mobilize-events`) and
// the Next server actions behind `/admin/events → Mobilize`. They therefore
// cannot drift into "what the preview showed" and "what the sync imported"
// being different event shapes.
//
// It deliberately imports nothing. Deno resolves `../_shared/mobilize.ts`, the
// Next bundler resolves `supabase/functions/_shared/mobilize`, and the unit
// tests import it directly — the same three-resolver arrangement as
// `_shared/commerce.ts`. A Deno global here would break the Next build, and a
// `node:` import would break `deno check`.
//
// The API is public and keyless (`https://api.mobilize.us/v1`), which is the
// sanctioned path. Mobilize's ToS prohibits framing and HTML extraction, so
// nothing here reads their pages: only `/v1` JSON. The mapper keeps a short
// plain-text summary and a link back, never mirrored images or long verbatim
// HTML.

export const MOBILIZE_API_BASE = 'https://api.mobilize.us/v1';

/** California. In-person events must sit in this state to be considered. */
export const MOBILIZE_STATE = 'CA';

/**
 * The national Indivisible organization. Every event this chapter has linked
 * from the site (1011420, 1072857, 903494, 967302) is sponsored by it, and
 * `mobilize.us/indivisiblefairoaks/` does not exist — which is why "watch our
 * org feed" is not a filter and the radius below is.
 */
export const MOBILIZE_DEFAULT_ORG_ID = 93;

/** The chapter's ZIP. Distance is measured from here. */
export const MOBILIZE_DEFAULT_ZIP = '95608';

export const MOBILIZE_DEFAULT_MAX_DIST = 25;

/**
 * Mobilize's own venue string when the address is private. It must never be
 * rendered as if it were a venue name, and `events.address` must not carry it.
 */
const PRIVATE_ADDRESS_SENTINEL = /this event[’']?s address is private/i;

/** How long a synced description may be. The card is a summary, not a mirror. */
const MAX_DESCRIPTION_LENGTH = 400;

export const EVENT_CATEGORIES = [
  'Meetings',
  'Resistance Choir',
  'Voter Mobilization',
  'Rallies & Street Action',
  'Community',
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export interface MobilizeTimeslot {
  id: number;
  start_date: number;
  end_date: number;
  is_full?: boolean;
}

export interface MobilizeLocation {
  venue?: string;
  address_lines?: string[];
  locality?: string;
  region?: string;
  postal_code?: string;
}

export interface MobilizeEvent {
  id: number;
  title: string;
  description?: string;
  summary?: string;
  browser_url: string;
  event_type: string;
  timezone?: string;
  timeslots?: MobilizeTimeslot[];
  location?: MobilizeLocation | null;
  is_virtual?: boolean;
  high_priority?: boolean | null;
  sponsor?: { id?: number; name?: string; slug?: string } | null;
  tags?: Array<{ id: number; name: string }>;
  accessibility_status?: string | null;
  accessibility_notes?: string;
  created_date?: number;
  modified_date?: number;
}

export interface MobilizeSettings {
  enabled: boolean;
  org_id: number;
  zipcode: string;
  max_dist: number;
  locality_allowlist: string[];
  include_virtual: boolean;
  high_priority_only: boolean;
  auto_publish: boolean;
}

export interface MobilizeEventRule {
  external_id: string;
  action: 'pin' | 'exclude';
}

/** The `events` row a Mobilize event maps onto. */
export interface MobilizeEventRow {
  slug: string;
  title: string;
  category: EventCategory;
  date_label: string;
  time_label: string;
  starts_at: string;
  ends_at: string;
  location_name: string;
  address: string;
  description: string;
  rsvp_url: string;
  external_id: string;
  external_url: string;
}

export interface MappedMobilizeEvent {
  row: MobilizeEventRow;
  timeslotId: number;
  warnings: string[];
}

export type MobilizeFilterVerdict = { include: true; reason: string } | { include: false; reason: string };

/**
 * Mobilize event type → the calendar's editorial category.
 *
 * Everything has an entry on purpose. A missing type used to fall through to
 * whatever the first branch happened to be; the explicit default is `Community`,
 * which is honest for a postcard party and a film night alike. `TRAINING` and
 * `WORKSHOP` land in Community rather than Voter Mobilization because they are
 * skills sessions, not canvasses — the page already presents them separately.
 */
const EVENT_TYPE_CATEGORY: Record<string, EventCategory> = {
  MEETING: 'Meetings',
  MEET_GREET: 'Meetings',
  OFFICE_OPENING: 'Meetings',
  RALLY: 'Rallies & Street Action',
  VISIBILITY_EVENT: 'Rallies & Street Action',
  SOLIDARITY_EVENT: 'Rallies & Street Action',
  BARNSTORM: 'Rallies & Street Action',
  TOWN_HALL: 'Rallies & Street Action',
  PETITION: 'Rallies & Street Action',
  SIGNATURE_GATHERING: 'Rallies & Street Action',
  CANVASS: 'Voter Mobilization',
  COMMUNITY_CANVASS: 'Voter Mobilization',
  PHONE_BANK: 'Voter Mobilization',
  AUTOMATED_PHONE_BANK: 'Voter Mobilization',
  TEXT_BANK: 'Voter Mobilization',
  VOTER_REG: 'Voter Mobilization',
  FRIEND_TO_FRIEND_OUTREACH: 'Voter Mobilization',
  ADVOCACY_CALL: 'Voter Mobilization',
  TRAINING: 'Community',
  WORKSHOP: 'Community',
  COMMUNITY: 'Community',
  FUNDRAISER: 'Community',
  HOUSE_PARTY: 'Community',
  DEBATE_WATCH_PARTY: 'Community',
  CARPOOL: 'Community',
  LETTER_WRITING: 'Community',
  LITERATURE_DROP_OFF: 'Community',
  INTEREST_FORM: 'Community',
  OTHER: 'Community',
};

export function categoryForEventType(eventType: string | undefined): EventCategory {
  return EVENT_TYPE_CATEGORY[(eventType ?? '').toUpperCase()] ?? 'Community';
}

/**
 * Event id from anything an organizer is likely to paste: the canonical page
 * (`mobilize.us/<org>/event/<id>/`), the short form, an API URL, or the bare
 * number. The example in issue #153 carries `?followup_modal_context=…`, which
 * is why the query string is ignored rather than required.
 */
export function parseMobilizeEventUrl(input: string): number | null {
  const value = (input ?? '').trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }
  const match = /\/events?\/(\d+)(?:[/?#]|$)/i.exec(value);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export interface MobilizeFeedParams {
  zipcode?: string;
  maxDist?: number;
  includeVirtual?: boolean;
  highPriorityOnly?: boolean;
  eventTypes?: string[];
}

/**
 * Numeric filters from a pasted Mobilize feed URL.
 *
 * This is the answer to "ask Erin which link is best": Mobilize's feed URL
 * generator produces `mobilize.us/<org>/?zipcode=…&max_dist=…`, and those names
 * are the API's names, so a link can be pasted into the admin preview and
 * understood without a translation table. The org slug in the path is *not*
 * resolved — that needs a lookup and the id is its own setting — and unknown
 * parameters are ignored rather than rejected.
 */
export function parseMobilizeFeedUrl(input: string): MobilizeFeedParams | null {
  const value = (input ?? '').trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (!/(^|\.)mobilize\.us$/i.test(url.hostname)) return null;

  const params: MobilizeFeedParams = {};
  const zip = url.searchParams.get('zipcode')?.trim();
  if (zip && /^\d{5}$/.test(zip)) params.zipcode = zip;

  const maxDist = Number(url.searchParams.get('max_dist'));
  if (Number.isInteger(maxDist) && maxDist >= 1 && maxDist <= 100) params.maxDist = maxDist;

  const virtual = url.searchParams.get('is_virtual');
  if (virtual === 'true' || virtual === 'false') params.includeVirtual = virtual === 'true';

  const highPriority = url.searchParams.get('high_priority_only');
  if (highPriority === 'true' || highPriority === 'false') {
    params.highPriorityOnly = highPriority === 'true';
  }

  const types = url.searchParams.getAll('event_types').filter(Boolean);
  if (types.length > 0) params.eventTypes = types;

  return params;
}

/**
 * The org-events request, built in one place so the preview shows exactly the
 * query the sync runs.
 *
 * `organization_id` as a *query param* is load-bearing: the path segment alone
 * returns events this org merely promoted, and the national No Kings calls
 * (sponsored by org 42198) arrive through that door. The param narrows it to
 * events the org owns.
 *
 * The virtual query carries `state=CA` because a virtual event has no location
 * for a radius to bite on — `state` is the only geographic handle Mobilize
 * offers there, and this is a California chapter.
 */
export function buildMobilizeEventsQuery(
  settings: Pick<MobilizeSettings, 'org_id' | 'zipcode' | 'max_dist' | 'high_priority_only'>,
  options: { virtual?: boolean; eventTypes?: string[] } = {}
): string {
  const params = new URLSearchParams();
  params.set('organization_id', String(settings.org_id));
  params.set('timeslot_start', 'gte_now');
  params.set('per_page', '50');

  if (options.virtual) {
    params.set('is_virtual', 'true');
    params.set('state', MOBILIZE_STATE);
  } else {
    params.set('is_virtual', 'false');
    params.set('zipcode', settings.zipcode);
    params.set('max_dist', String(settings.max_dist));
  }

  if (settings.high_priority_only) params.set('high_priority_only', 'true');
  for (const type of options.eventTypes ?? []) params.append('event_types', type);

  return `${MOBILIZE_API_BASE}/organizations/${settings.org_id}/events?${params.toString()}`;
}

export function buildMobilizeEventUrl(eventId: number): string {
  return `${MOBILIZE_API_BASE}/events/${eventId}`;
}

/**
 * Why an event is or is not in scope.
 *
 * A rule outranks every filter in both directions: `exclude` keeps an event out
 * even when it matches, `pin` pulls one in even when it does not. That is the
 * mechanism for "one national virtual call, not the other fifty".
 *
 * In-person geography is two checks, not one. The API's radius is a distance
 * from the chapter's ZIP, so 25 miles from Carmichael reaches Roseville and
 * Elk Grove; the locality allowlist is what makes "only Sacramento" true.
 */
export function passesMobilizeFilters(
  event: MobilizeEvent,
  settings: MobilizeSettings,
  rules: readonly MobilizeEventRule[] = []
): MobilizeFilterVerdict {
  const rule = rules.find((candidate) => candidate.external_id === String(event.id));

  if (rule?.action === 'exclude') return { include: false, reason: 'rule:exclude' };
  if (rule?.action === 'pin') return { include: true, reason: 'rule:pin' };

  if (settings.high_priority_only && !event.high_priority) {
    return { include: false, reason: 'not-high-priority' };
  }

  if (event.is_virtual) {
    return settings.include_virtual
      ? { include: true, reason: 'virtual' }
      : { include: false, reason: 'virtual-disabled' };
  }

  const region = (event.location?.region ?? '').trim().toUpperCase();
  if (region !== MOBILIZE_STATE) return { include: false, reason: 'outside-state' };

  const locality = (event.location?.locality ?? '').trim().toLowerCase();
  const allowlist = settings.locality_allowlist.map((name) => name.trim().toLowerCase());
  if (!locality || !allowlist.includes(locality)) {
    return { include: false, reason: 'outside-locality' };
  }

  return { include: true, reason: 'in-scope' };
}

/**
 * Clean text for a card: tags out, entities in, whitespace collapsed, clipped
 * at a word boundary. Mobilize descriptions are HTML, and this repository
 * renders `events.description` as text — storing the HTML would either show
 * literal tags or force every consumer through the sanitizer for content we
 * only ever summarise.
 */
export function plainTextFromHtml(html: string | undefined): string {
  if (!html) return '';
  const text = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&rsquo;/gi, '’')
    .replace(/&ldquo;/gi, '“')
    .replace(/&rdquo;/gi, '”')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= MAX_DESCRIPTION_LENGTH) return text;
  const clipped = text.slice(0, MAX_DESCRIPTION_LENGTH);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > MAX_DESCRIPTION_LENGTH * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

function safeTimeZone(timezone: string | undefined): string {
  const candidate = (timezone ?? '').trim();
  if (!candidate) return 'America/Los_Angeles';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return 'America/Los_Angeles';
  }
}

export function formatDateLabel(date: Date, timezone: string | undefined): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimeZone(timezone),
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatClock(date: Date, timezone: string | undefined): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimeZone(timezone),
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function sameWallDay(a: Date, b: Date, timezone: string | undefined): boolean {
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return format.format(a) === format.format(b);
}

/** `6:30 PM – 8:00 PM`, or a single clock when the end is unknown. */
export function formatTimeLabel(
  start: Date,
  end: Date | null,
  timezone: string | undefined
): string {
  const startLabel = formatClock(start, timezone);
  if (!end || Number.isNaN(end.getTime())) return startLabel;
  return `${startLabel} – ${formatClock(end, timezone)}`;
}

/**
 * The next timeslot that has not already finished.
 *
 * A Mobilize event can carry a whole series — the chapter's monthly gathering
 * currently has six — and the calendar models one row per event. Picking the
 * next upcoming one is what lets a recurring meeting roll forward after each
 * occurrence instead of becoming six identical cards.
 */
export function nextUpcomingTimeslot(
  event: MobilizeEvent,
  now: Date = new Date()
): MobilizeTimeslot | null {
  const upcoming = (event.timeslots ?? [])
    .filter((slot) => Number.isFinite(slot.start_date) && slot.start_date * 1000 > now.getTime())
    .sort((a, b) => a.start_date - b.start_date);
  return upcoming[0] ?? null;
}

function clamp(value: string, max: number): string {
  return value.length > max ? value.slice(0, max).trimEnd() : value;
}

function displayName(event: MobilizeEvent): { locationName: string; address: string } {
  if (event.is_virtual) {
    return { locationName: 'Online', address: '' };
  }

  const location = event.location ?? {};
  const venue = (location.venue ?? '').trim();
  const lines = (location.address_lines ?? []).map((line) => line.trim()).filter(Boolean);
  const locality = (location.locality ?? '').trim();
  const region = (location.region ?? '').trim();
  const place = [locality, region].filter(Boolean).join(', ');

  const addressIsPrivate =
    PRIVATE_ADDRESS_SENTINEL.test(venue) || lines.some((line) => PRIVATE_ADDRESS_SENTINEL.test(line));

  if (addressIsPrivate) {
    // A private address is a fact about the event, not a venue name. Showing
    // Mobilize's sentence on the card would be noise; showing the sentence as
    // an *address* would also be wrong. The place is public, the street is not.
    return { locationName: place || 'Location shared on RSVP', address: '' };
  }

  return {
    locationName: venue || place,
    address: clamp(lines.join(', '), 300),
  };
}

/**
 * One Mobilize event → one `events` row, or `null` when it has no upcoming
 * timeslot (the caller hides an existing row rather than creating one).
 *
 * `category` is returned but is only used on insert: the sync never rewrites a
 * category, so an admin who files the choir rehearsal under "Resistance Choir"
 * is not overruled by Mobilize's `MEETING` type on the next run.
 */
export function mapMobilizeEvent(
  event: MobilizeEvent,
  now: Date = new Date()
): MappedMobilizeEvent | null {
  const timeslot = nextUpcomingTimeslot(event, now);
  if (!timeslot) return null;

  const warnings: string[] = [];
  const startsAt = new Date(timeslot.start_date * 1000);
  const endsAt = new Date(timeslot.end_date * 1000);
  const timezone = safeTimeZone(event.timezone);
  if (timezone !== event.timezone) {
    warnings.push(`Unknown timezone "${event.timezone ?? ''}" — rendered as Pacific.`);
  }

  const { locationName, address } = displayName(event);
  if (address === '' && !event.is_virtual) {
    warnings.push('Address is private on Mobilize — the card shows the city only.');
  }

  const endIsUsable = !Number.isNaN(endsAt.getTime()) && endsAt.getTime() > startsAt.getTime();
  const dateLabel = endIsUsable && !sameWallDay(startsAt, endsAt, timezone)
    ? `${formatDateLabel(startsAt, timezone)} – ${formatDateLabel(endsAt, timezone)}`
    : formatDateLabel(startsAt, timezone);

  return {
    timeslotId: timeslot.id,
    warnings,
    row: {
      slug: `mobilize-${event.id}`,
      title: clamp((event.title ?? '').replace(/\s+/g, ' ').trim(), 200),
      category: categoryForEventType(event.event_type),
      date_label: clamp(dateLabel, 100),
      time_label: clamp(formatTimeLabel(startsAt, endIsUsable ? endsAt : null, timezone), 100),
      starts_at: startsAt.toISOString(),
      ends_at: (endIsUsable ? endsAt : startsAt).toISOString(),
      location_name: clamp(locationName, 200),
      address,
      description: plainTextFromHtml(event.description || event.summary),
      rsvp_url: clamp(event.browser_url ?? '', 500),
      external_id: String(event.id),
      external_url: clamp(event.browser_url ?? '', 500),
    },
  };
}

/** `true` when the event has no timeslot left to show. */
export function isEventFinished(event: MobilizeEvent, now: Date = new Date()): boolean {
  return nextUpcomingTimeslot(event, now) === null;
}
