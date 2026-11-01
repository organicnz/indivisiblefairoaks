// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildMobilizeEventsQuery,
  categoryForEventType,
  formatTimeLabel,
  isEventFinished,
  type MobilizeEvent,
  type MobilizeSettings,
  mapMobilizeEvent,
  parseMobilizeEventUrl,
  parseMobilizeFeedUrl,
  passesMobilizeFilters,
} from '../../../supabase/functions/_shared/mobilize';

/**
 * Fixtures are trimmed captures of real `api.mobilize.us/v1/events/:id`
 * responses, taken while scoping issue #153. The ids are the ones the site
 * already links, so a mapping regression shows up against the shapes that
 * actually reach the calendar — including the two the plan called out: a
 * recurring event with six timeslots, and a private address.
 */

/** `GET /v1/events/967302` — the Monthly Gathering, six monthly timeslots. */
const MONTHLY_GATHERING: MobilizeEvent = {
  id: 967302,
  title: 'Indivisible Fair Oaks-Carmichael Monthly Gathering',
  description:
    '<p>This a local Indivisible event! We gather to organize together.</p><p>A core principle behind all Indivisible events is a <strong>commitment to nonviolent action</strong>.</p>',
  browser_url: 'https://www.mobilize.us/indivisible/event/967302/',
  event_type: 'MEETING',
  timezone: 'America/Los_Angeles',
  is_virtual: false,
  high_priority: false,
  sponsor: { id: 93, name: 'Indivisible', slug: 'indivisible' },
  location: {
    venue: 'This event’s address is private. Sign up for more details',
    address_lines: ['This event’s address is private. Sign up for more details', ''],
    locality: 'Carmichael',
    region: 'CA',
    postal_code: '95608',
  },
  timeslots: [
    { id: 1, start_date: 1783474200, end_date: 1783479600 },
    { id: 2, start_date: 1785893400, end_date: 1785898800 },
    { id: 3, start_date: 1788312600, end_date: 1788318000 },
    { id: 4, start_date: 1791336600, end_date: 1791342000 },
    { id: 5, start_date: 1794364200, end_date: 1794369600 },
    { id: 6, start_date: 1796178600, end_date: 1796184000 },
  ],
};

/** `GET /v1/events/1004390` — a neighbouring chapter, in the radius. */
const CITRUS_HEIGHTS: MobilizeEvent = {
  id: 1004390,
  title: 'Indivisible Citrus Heights Postcard Party',
  description: 'Writing postcards to voters.',
  browser_url: 'https://www.mobilize.us/indivisible/event/1004390/',
  event_type: 'POSTCARD_WRITING',
  timezone: 'America/Los_Angeles',
  is_virtual: false,
  location: {
    venue: 'Community Center',
    address_lines: ['123 Main St', ''],
    locality: 'Citrus Heights',
    region: 'CA',
  },
  timeslots: [{ id: 1, start_date: 1794364200, end_date: 1794369600 }],
};

/** A virtual event, which carries no location for a radius to filter on. */
const VIRTUAL_CA: MobilizeEvent = {
  id: 947906,
  title: 'Virtual Neighbors Forums',
  description: 'A statewide call.',
  browser_url: 'https://www.mobilize.us/indivisible/event/947906/',
  event_type: 'COMMUNITY',
  timezone: 'America/Los_Angeles',
  is_virtual: true,
  location: null,
  timeslots: [{ id: 1, start_date: 1794364200, end_date: 1794369600 }],
};

const SETTINGS: MobilizeSettings = {
  enabled: true,
  org_id: 93,
  zipcode: '95608',
  max_dist: 25,
  locality_allowlist: ['Sacramento', 'Carmichael', 'Fair Oaks', 'Citrus Heights'],
  include_virtual: false,
  high_priority_only: false,
  auto_publish: true,
};

const NOW = new Date('2026-10-31T12:00:00Z');

describe('parseMobilizeEventUrl', () => {
  it('finds the id in a canonical event page, ignoring the follow-up modal query', () => {
    expect(
      parseMobilizeEventUrl(
        'https://www.mobilize.us/nokings/event/1074514/?followup_modal_context=organization_newsletter_custom_recommendations'
      )
    ).toBe(1074514);
  });

  it('accepts the short form, the API url and a bare id', () => {
    expect(parseMobilizeEventUrl('https://www.mobilize.us/event/1011420/')).toBe(1011420);
    expect(parseMobilizeEventUrl('https://api.mobilize.us/v1/events/1072857')).toBe(1072857);
    expect(parseMobilizeEventUrl(' 967302 ')).toBe(967302);
  });

  it('rejects anything without an event id', () => {
    expect(parseMobilizeEventUrl('https://www.mobilize.us/indivisible/')).toBeNull();
    expect(parseMobilizeEventUrl('not a link')).toBeNull();
    expect(parseMobilizeEventUrl('')).toBeNull();
    expect(parseMobilizeEventUrl('0')).toBeNull();
  });
});

describe('parseMobilizeFeedUrl', () => {
  it('reads the filters Mobilize’s feed URL generator writes', () => {
    expect(
      parseMobilizeFeedUrl(
        'https://www.mobilize.us/indivisible/?zipcode=95608&max_dist=30&is_virtual=false&high_priority_only=true'
      )
    ).toEqual({ zipcode: '95608', maxDist: 30, includeVirtual: false, highPriorityOnly: true });
  });

  it('ignores invalid values rather than guessing', () => {
    expect(
      parseMobilizeFeedUrl('https://www.mobilize.us/indivisible/?zipcode=9560&max_dist=900')
    ).toEqual({});
  });

  it('rejects another host', () => {
    expect(parseMobilizeFeedUrl('https://example.com/?zipcode=95608')).toBeNull();
  });
});

describe('buildMobilizeEventsQuery', () => {
  it('filters to org-owned events and the chapter radius', () => {
    const query = new URL(buildMobilizeEventsQuery(SETTINGS));
    expect(query.origin + query.pathname).toBe(
      'https://api.mobilize.us/v1/organizations/93/events'
    );
    expect(query.searchParams.get('organization_id')).toBe('93');
    expect(query.searchParams.get('zipcode')).toBe('95608');
    expect(query.searchParams.get('max_dist')).toBe('25');
    expect(query.searchParams.get('is_virtual')).toBe('false');
    expect(query.searchParams.get('timeslot_start')).toBe('gte_now');
  });

  it('asks for California virtual events when that scope is on', () => {
    const query = new URL(buildMobilizeEventsQuery(SETTINGS, { virtual: true }));
    expect(query.searchParams.get('is_virtual')).toBe('true');
    expect(query.searchParams.get('state')).toBe('CA');
    // A virtual event has no location, so a radius would silently exclude all
    // of them — the two shapes must not be blended into one query.
    expect(query.searchParams.get('zipcode')).toBeNull();
    expect(query.searchParams.get('max_dist')).toBeNull();
  });
});

describe('passesMobilizeFilters', () => {
  it('admits an in-person event in an allowlisted city', () => {
    expect(passesMobilizeFilters(MONTHLY_GATHERING, SETTINGS)).toEqual({
      include: true,
      reason: 'in-scope',
    });
  });

  it('matches the locality case-insensitively', () => {
    const lowered = { ...SETTINGS, locality_allowlist: ['carmichael'] };
    expect(passesMobilizeFilters(MONTHLY_GATHERING, lowered).include).toBe(true);
  });

  it('rejects a city outside the list and says why', () => {
    const lodi: MobilizeEvent = {
      ...CITRUS_HEIGHTS,
      id: 42,
      location: { ...CITRUS_HEIGHTS.location, locality: 'Lodi' },
    };
    expect(passesMobilizeFilters(lodi, SETTINGS)).toEqual({
      include: false,
      reason: 'outside-locality',
    });
  });

  it('rejects another state', () => {
    const nevada: MobilizeEvent = {
      ...CITRUS_HEIGHTS,
      id: 43,
      location: { ...CITRUS_HEIGHTS.location, region: 'NV' },
    };
    expect(passesMobilizeFilters(nevada, SETTINGS)).toEqual({
      include: false,
      reason: 'outside-state',
    });
  });

  it('keeps virtual events out until they are explicitly enabled', () => {
    expect(passesMobilizeFilters(VIRTUAL_CA, SETTINGS)).toEqual({
      include: false,
      reason: 'virtual-disabled',
    });
    expect(passesMobilizeFilters(VIRTUAL_CA, { ...SETTINGS, include_virtual: true })).toEqual({
      include: true,
      reason: 'virtual',
    });
  });

  it('drops unpinned events when the priority filter is on', () => {
    expect(
      passesMobilizeFilters(MONTHLY_GATHERING, { ...SETTINGS, high_priority_only: true })
    ).toEqual({ include: false, reason: 'not-high-priority' });
  });

  it('lets a rule outrank the filters in both directions', () => {
    expect(
      passesMobilizeFilters(VIRTUAL_CA, SETTINGS, [{ external_id: '947906', action: 'pin' }])
    ).toEqual({ include: true, reason: 'rule:pin' });

    expect(
      passesMobilizeFilters(MONTHLY_GATHERING, SETTINGS, [
        { external_id: '967302', action: 'exclude' },
      ])
    ).toEqual({ include: false, reason: 'rule:exclude' });
  });
});

describe('mapMobilizeEvent', () => {
  it('rolls a recurring event forward to its next timeslot', () => {
    const mapped = mapMobilizeEvent(MONTHLY_GATHERING, NOW);
    expect(mapped).not.toBeNull();
    expect(mapped?.timeslotId).toBe(5);
    expect(mapped?.row.starts_at).toBe('2026-11-11T02:30:00.000Z');
    expect(mapped?.row.date_label).toBe('Tuesday, November 10, 2026');
    expect(mapped?.row.time_label).toBe('6:30 PM – 8:00 PM');
  });

  it('turns a private address into the city, never the sentinel', () => {
    const mapped = mapMobilizeEvent(MONTHLY_GATHERING, NOW);
    expect(mapped?.row.location_name).toBe('Carmichael, CA');
    expect(mapped?.row.address).toBe('');
    expect(mapped?.warnings.join(' ')).toContain('Address is private');
  });

  it('strips HTML from the description', () => {
    const mapped = mapMobilizeEvent(MONTHLY_GATHERING, NOW);
    expect(mapped?.row.description).not.toContain('<');
    expect(mapped?.row.description).toContain('commitment to nonviolent action');
  });

  it('clips a long description at a word boundary', () => {
    const long: MobilizeEvent = {
      ...MONTHLY_GATHERING,
      description: `<p>${'word '.repeat(200)}</p>`,
    };
    const mapped = mapMobilizeEvent(long, NOW);
    expect(mapped?.row.description.length).toBeLessThanOrEqual(401);
    expect(mapped?.row.description.endsWith('…')).toBe(true);
    expect(mapped?.row.description).not.toContain('wor…');
  });

  it('marks a virtual event Online', () => {
    const mapped = mapMobilizeEvent(VIRTUAL_CA, NOW);
    expect(mapped?.row.location_name).toBe('Online');
    expect(mapped?.row.address).toBe('');
  });

  it('carries the canonical RSVP link and a deterministic slug', () => {
    const mapped = mapMobilizeEvent(CITRUS_HEIGHTS, NOW);
    expect(mapped?.row.rsvp_url).toBe('https://www.mobilize.us/indivisible/event/1004390/');
    expect(mapped?.row.external_id).toBe('1004390');
    expect(mapped?.row.slug).toBe('mobilize-1004390');
  });

  it('returns null when every timeslot has finished, so the caller hides the row', () => {
    expect(mapMobilizeEvent(MONTHLY_GATHERING, new Date('2027-01-01T00:00:00Z'))).toBeNull();
    expect(isEventFinished(MONTHLY_GATHERING, new Date('2027-01-01T00:00:00Z'))).toBe(true);
    expect(isEventFinished(MONTHLY_GATHERING, NOW)).toBe(false);
  });

  it('falls back to Pacific for an unknown timezone, and says so', () => {
    const broken: MobilizeEvent = { ...CITRUS_HEIGHTS, timezone: 'Not/AZone' };
    const mapped = mapMobilizeEvent(broken, NOW);
    expect(mapped?.row.date_label).toBe('Tuesday, November 10, 2026');
    expect(mapped?.warnings.join(' ')).toContain('Unknown timezone');
  });

  it('formats the end time only when the end is usable', () => {
    const start = new Date('2026-11-11T02:30:00Z');
    expect(formatTimeLabel(start, null, 'America/Los_Angeles')).toBe('6:30 PM');
    expect(formatTimeLabel(start, new Date('2026-11-11T04:00:00Z'), 'America/Los_Angeles')).toBe(
      '6:30 PM – 8:00 PM'
    );
  });
});

describe('categoryForEventType', () => {
  it('maps every documented type to a category that exists', () => {
    expect(categoryForEventType('MEETING')).toBe('Meetings');
    expect(categoryForEventType('VISIBILITY_EVENT')).toBe('Rallies & Street Action');
    expect(categoryForEventType('CANVASS')).toBe('Voter Mobilization');
    expect(categoryForEventType('TEXT_BANK')).toBe('Voter Mobilization');
    expect(categoryForEventType('COMMUNITY')).toBe('Community');
    expect(categoryForEventType('POSTCARD_WRITING')).toBe('Community');
    expect(categoryForEventType('TRAINING')).toBe('Community');
  });

  it('defaults unknown and missing types to Community rather than a neighbour', () => {
    expect(categoryForEventType('SOMETHING_NEW')).toBe('Community');
    expect(categoryForEventType(undefined)).toBe('Community');
  });
});
